package server

import (
	"context"
	"errors"
	"strings"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

const testSkillBody = "---\nname: cpu-report\ndescription: \"d\"\n---\n\n# Body\n"

func TestValidateOpenClawSkillFiles(t *testing.T) {
	tests := []struct {
		name    string
		main    string
		support []cloudhub.OpenClawSkillFile
		wantErr bool
	}{
		{name: "minimal valid", main: testSkillBody},
		{
			name: "valid support file", main: testSkillBody,
			support: []cloudhub.OpenClawSkillFile{{Path: "scripts/collect.sh", Content: "echo hi"}},
		},
		{
			name: "every allowed folder", main: testSkillBody,
			support: []cloudhub.OpenClawSkillFile{
				{Path: "assets/logo.txt", Content: "x"},
				{Path: "examples/one.md", Content: "x"},
				{Path: "references/spec.md", Content: "x"},
				{Path: "scripts/run.sh", Content: "x"},
				{Path: "templates/report.md", Content: "x"},
			},
		},
		{name: "no frontmatter", main: "# Body", wantErr: true},
		{name: "unterminated frontmatter", main: "---\nname: cpu-report\n", wantErr: true},
		{name: "missing frontmatter name", main: "---\ndescription: \"d\"\n---\n", wantErr: true},
		{name: "missing frontmatter description", main: "---\nname: cpu-report\n---\n", wantErr: true},
		{
			name:    "description too long",
			main:    "---\nname: cpu-report\ndescription: \"" + strings.Repeat("d", maxOpenClawSkillDescBytes+1) + "\"\n---\n",
			wantErr: true,
		},
		{name: "body too large", main: strings.Repeat("x", 40001), wantErr: true},
		{
			name: "support path outside the standard folders", main: testSkillBody,
			support: []cloudhub.OpenClawSkillFile{{Path: "bin/run.sh", Content: "x"}}, wantErr: true,
		},
		{
			name: "support path escapes upward", main: testSkillBody,
			support: []cloudhub.OpenClawSkillFile{{Path: "scripts/../../etc/passwd", Content: "x"}}, wantErr: true,
		},
		{
			name: "absolute support path", main: testSkillBody,
			support: []cloudhub.OpenClawSkillFile{{Path: "/etc/passwd", Content: "x"}}, wantErr: true,
		},
		{
			name: "hidden segment", main: testSkillBody,
			support: []cloudhub.OpenClawSkillFile{{Path: "scripts/.hidden", Content: "x"}}, wantErr: true,
		},
		{
			name: "SKILL.md as a support file", main: testSkillBody,
			support: []cloudhub.OpenClawSkillFile{{Path: "SKILL.md", Content: "x"}}, wantErr: true,
		},
		{
			name: "duplicate support paths", main: testSkillBody,
			support: []cloudhub.OpenClawSkillFile{
				{Path: "scripts/a.sh", Content: "x"},
				{Path: "scripts/a.sh", Content: "y"},
			}, wantErr: true,
		},
		{
			name: "null byte in content", main: testSkillBody,
			support: []cloudhub.OpenClawSkillFile{{Path: "scripts/a.sh", Content: "a\x00b"}}, wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateOpenClawSkillFiles(tt.main, tt.support)
			if tt.wantErr && err == nil {
				t.Fatal("want error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("want nil, got %v", err)
			}
		})
	}
}

func TestValidateOpenClawSkillFilesRejectsTooManySupportFiles(t *testing.T) {
	support := make([]cloudhub.OpenClawSkillFile, 0, 51)
	for i := 0; i < 51; i++ {
		support = append(support, cloudhub.OpenClawSkillFile{
			Path:    "scripts/file" + strings.Repeat("a", i) + ".sh",
			Content: "x",
		})
	}
	if err := validateOpenClawSkillFiles(testSkillBody, support); err == nil {
		t.Fatal("51 support files accepted, want rejection")
	}
}

func TestValidateOpenClawSkillFilesRejectsTooLargeATotal(t *testing.T) {
	support := []cloudhub.OpenClawSkillFile{
		{Path: "scripts/big.sh", Content: strings.Repeat("x", 1<<20)},
	}
	if err := validateOpenClawSkillFiles(testSkillBody, support); err == nil {
		t.Fatal("oversized skill accepted, want rejection")
	}
}

func TestValidateOpenClawSkillName(t *testing.T) {
	valid := []string{"cpu-report", "a", "a_b-c9", strings.Repeat("a", 64)}
	for _, name := range valid {
		if err := validateOpenClawSkillName(name); err != nil {
			t.Fatalf("%q rejected: %v", name, err)
		}
	}

	invalid := []string{
		"", "9lives", "CPU", "cpu report", "cpu/report", "-leading",
		"skill", "learn", "exec", "bash", "status", "config", "model",
		strings.Repeat("a", 65),
	}
	for _, name := range invalid {
		if err := validateOpenClawSkillName(name); err == nil {
			t.Fatalf("%q accepted, want rejection", name)
		}
	}
}

func TestOpenClawFrontmatterReadsNameAndDescription(t *testing.T) {
	name, description, err := openClawFrontmatter(testSkillBody)
	if err != nil {
		t.Fatalf("frontmatter: %v", err)
	}
	if name != "cpu-report" || description != "d" {
		t.Fatalf("name/description = %q / %q", name, description)
	}
}

func TestOpenClawTreeHashIgnoresOrderAndTracksContent(t *testing.T) {
	a := []cloudhub.OpenClawSkillFile{
		{Path: "SKILL.md", ContentHash: "h1"},
		{Path: "scripts/a.sh", ContentHash: "h2"},
	}
	b := []cloudhub.OpenClawSkillFile{
		{Path: "scripts/a.sh", ContentHash: "h2"},
		{Path: "SKILL.md", ContentHash: "h1"},
	}
	if openClawTreeHash(a) != openClawTreeHash(b) {
		t.Fatal("tree hash depends on input order")
	}

	changed := []cloudhub.OpenClawSkillFile{
		{Path: "SKILL.md", ContentHash: "h1"},
		{Path: "scripts/a.sh", ContentHash: "CHANGED"},
	}
	if openClawTreeHash(a) == openClawTreeHash(changed) {
		t.Fatal("tree hash ignores content changes")
	}

	removed := []cloudhub.OpenClawSkillFile{{Path: "SKILL.md", ContentHash: "h1"}}
	if openClawTreeHash(a) == openClawTreeHash(removed) {
		t.Fatal("tree hash ignores a removed file")
	}

	// A path rename with identical content must still change the hash,
	// otherwise moving a script would look like no change at all.
	renamed := []cloudhub.OpenClawSkillFile{
		{Path: "SKILL.md", ContentHash: "h1"},
		{Path: "scripts/b.sh", ContentHash: "h2"},
	}
	if openClawTreeHash(a) == openClawTreeHash(renamed) {
		t.Fatal("tree hash ignores a renamed file")
	}
}

func TestOpenClawSkillFilesPutsTheBodyFirst(t *testing.T) {
	files := openClawSkillFiles("body", []openClawSkillFileDTO{
		{Path: "scripts/collect.sh", Content: "echo hi"},
	})
	if len(files) != 2 {
		t.Fatalf("files = %+v", files)
	}
	if files[0].Path != openClawMainPath || files[0].Content != "body" {
		t.Fatalf("first file = %+v", files[0])
	}
	if files[0].SizeBytes != 4 || files[0].ContentHash == "" {
		t.Fatalf("body hash/size not filled: %+v", files[0])
	}
	if files[1].Path != "scripts/collect.sh" || files[1].SizeBytes != 7 {
		t.Fatalf("support file = %+v", files[1])
	}
}

type stubPublisher struct {
	published []openclaw.SkillPayload
	agents    []string
	err       error

	inventory    []openclaw.SkillInventoryEntry
	inventoryErr error
	inventoryFor []string

	workspaceFiles []openclaw.SkillFile
	workspaceErr   error
	workspaceFor   []string
}

func (p *stubPublisher) WorkspaceSkill(_ context.Context, agentID, name string) ([]openclaw.SkillFile, error) {
	p.workspaceFor = append(p.workspaceFor, agentID+"/"+name)
	if p.workspaceErr != nil {
		return nil, p.workspaceErr
	}
	return p.workspaceFiles, nil
}

func (p *stubPublisher) Inventory(_ context.Context, agentID string) ([]openclaw.SkillInventoryEntry, error) {
	p.inventoryFor = append(p.inventoryFor, agentID)
	if p.inventoryErr != nil {
		return nil, p.inventoryErr
	}
	return p.inventory, nil
}

func (p *stubPublisher) Publish(_ context.Context, agentID string, payload openclaw.SkillPayload) (openclaw.PublishResult, error) {
	if p.err != nil {
		return openclaw.PublishResult{}, p.err
	}
	p.agents = append(p.agents, agentID)
	p.published = append(p.published, payload)
	return openclaw.PublishResult{ProposalID: "proposal-1", Scan: []byte(`{"state":"clean"}`)}, nil
}

func testRevisionFiles() []cloudhub.OpenClawSkillFile {
	return []cloudhub.OpenClawSkillFile{
		{Path: "SKILL.md", Content: testSkillBody},
		{Path: "scripts/collect.sh", Content: "echo hi"},
	}
}

// Recording an approval the Gateway refused would leave CloudHub claiming a
// revision is live when the workspace never received it.
func TestOpenClawApproveDoesNotRecordTheReviewWhenPublishFails(t *testing.T) {
	reviewed, activated := false, false

	err := approveOpenClawRevision(context.Background(), approveDeps{
		publisher: &stubPublisher{err: errors.New("gateway down")},
		agentID:   "agent-1",
		skillName: "cpu-report",
		files:     testRevisionFiles(),
		recordReview: func(cloudhub.OpenClawSkillReview) error {
			reviewed = true
			return nil
		},
		activate: func() error {
			activated = true
			return nil
		},
	})
	if err == nil {
		t.Fatal("approve succeeded, want error")
	}
	if reviewed {
		t.Fatal("the review was recorded even though the Gateway rejected the publish")
	}
	if activated {
		t.Fatal("the revision was activated even though the Gateway rejected the publish")
	}
}

func TestOpenClawApprovePublishesMainAndSupportSeparately(t *testing.T) {
	publisher := &stubPublisher{}
	var recorded cloudhub.OpenClawSkillReview

	err := approveOpenClawRevision(context.Background(), approveDeps{
		publisher:  publisher,
		agentID:    "agent-1",
		skillName:  "cpu-report",
		files:      testRevisionFiles(),
		reviewedBy: "9",
		note:       "looks fine",
		recordReview: func(review cloudhub.OpenClawSkillReview) error {
			recorded = review
			return nil
		},
		activate: func() error { return nil },
	})
	if err != nil {
		t.Fatalf("approve: %v", err)
	}

	if len(publisher.published) != 1 {
		t.Fatalf("published %d payloads", len(publisher.published))
	}
	payload := publisher.published[0]
	if payload.Main != testSkillBody {
		t.Fatalf("main = %q", payload.Main)
	}
	if len(payload.Support) != 1 || payload.Support[0].Path != "scripts/collect.sh" {
		t.Fatalf("support = %+v", payload.Support)
	}
	if payload.Name != "cpu-report" || payload.Description != "d" {
		t.Fatalf("name/description = %q / %q", payload.Name, payload.Description)
	}
	if publisher.agents[0] != "agent-1" {
		t.Fatalf("agent = %q", publisher.agents[0])
	}

	if recorded.Status != cloudhub.OpenClawReviewApproved ||
		recorded.ReviewedBy != "9" ||
		recorded.Note != "looks fine" ||
		recorded.ProposalID != "proposal-1" ||
		string(recorded.Scan) != `{"state":"clean"}` {
		t.Fatalf("review = %+v", recorded)
	}
}

func TestOpenClawApproveRejectsARevisionWithoutABody(t *testing.T) {
	err := approveOpenClawRevision(context.Background(), approveDeps{
		publisher: &stubPublisher{},
		agentID:   "agent-1",
		skillName: "cpu-report",
		files: []cloudhub.OpenClawSkillFile{
			{Path: "scripts/collect.sh", Content: "echo hi"},
		},
		recordReview: func(cloudhub.OpenClawSkillReview) error { return nil },
		activate:     func() error { return nil },
	})
	if err == nil {
		t.Fatal("approve succeeded without SKILL.md, want error")
	}
}

func TestValidateOpenClawOrgAgents(t *testing.T) {
	valid := map[string]string{
		cloudhub.OpenClawAgentAuthoring: "cloudhub-authoring",
		cloudhub.OpenClawAgentExecution: "cloudhub-main",
	}
	if err := validateOpenClawOrgAgents(valid); err != nil {
		t.Fatalf("valid mapping rejected: %v", err)
	}
	if err := validateOpenClawOrgAgents(map[string]string{}); err != nil {
		t.Fatalf("empty mapping rejected: %v", err)
	}

	if err := validateOpenClawOrgAgents(map[string]string{"nonsense": "a"}); err == nil {
		t.Fatal("unknown purpose accepted")
	}
	if err := validateOpenClawOrgAgents(map[string]string{cloudhub.OpenClawAgentExecution: "   "}); err == nil {
		t.Fatal("blank agent id accepted")
	}
	if err := validateOpenClawOrgAgents(map[string]string{
		cloudhub.OpenClawAgentExecution: strings.Repeat("a", 201),
	}); err == nil {
		t.Fatal("over-long agent id accepted")
	}
}

// A SKILL.md drafted by an LLM routinely carries nested structures in its
// frontmatter. Reading a key out of one of those as the skill's own field
// silently replaces the description with something plausible but wrong, so the
// scan is limited to top-level keys.
func TestOpenClawFrontmatterIgnoresNestedKeys(t *testing.T) {
	main := "---\n" +
		"name: nginx-5xx-monitor\n" +
		"description: Report the 5xx rate for an nginx host.\n" +
		"parameters:\n" +
		"  log_path:\n" +
		"    name: not-the-skill-name\n" +
		"    description: Path to the nginx access log.\n" +
		"  threshold_percent:\n" +
		"    description: Percentage of 5xx before alerting.\n" +
		"---\n\n# Body\n"

	name, description, err := openClawFrontmatter(main)
	if err != nil {
		t.Fatalf("frontmatter: %v", err)
	}
	if name != "nginx-5xx-monitor" {
		t.Fatalf("name = %q, want the top-level one", name)
	}
	if description != "Report the 5xx rate for an nginx host." {
		t.Fatalf("description = %q, want the top-level one", description)
	}
}

func TestOpenClawFrontmatterReadsBlockScalars(t *testing.T) {
	tests := []struct {
		name string
		main string
		want string
	}{
		{
			name: "literal",
			main: "---\nname: a-skill\ndescription: |\n  First line.\n  Second line.\nother: x\n---\n",
			want: "First line.\nSecond line.",
		},
		{
			name: "folded",
			main: "---\nname: a-skill\ndescription: >\n  First line.\n  Second line.\n---\n",
			want: "First line. Second line.",
		},
		{
			name: "chomping indicator",
			main: "---\nname: a-skill\ndescription: |-\n  Only line.\n---\n",
			want: "Only line.",
		},
		{
			name: "blank line inside the block",
			main: "---\nname: a-skill\ndescription: |\n  First.\n\n  Third.\n---\n",
			want: "First.\n\nThird.",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			name, description, err := openClawFrontmatter(test.main)
			if err != nil {
				t.Fatalf("frontmatter: %v", err)
			}
			if name != "a-skill" {
				t.Fatalf("name = %q", name)
			}
			if description != test.want {
				t.Fatalf("description = %q, want %q", description, test.want)
			}
		})
	}
}

// A block scalar that holds nothing leaves the description empty, which has to
// be refused rather than passed on as a skill with no description.
func TestOpenClawFrontmatterRejectsAnEmptyBlockScalar(t *testing.T) {
	if _, _, err := openClawFrontmatter("---\nname: a-skill\ndescription: |\nother: x\n---\n"); err == nil {
		t.Fatal("an empty block scalar was accepted")
	}
}
