package skilldir

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

// writeAgentSkill puts one skill directory in an agent's workspace.
func writeAgentSkill(t *testing.T, root, agentID, name string, files map[string]string) {
	t.Helper()
	for path, content := range files {
		full := filepath.Join(root, agentID, "skills", name, path)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func copyService(t *testing.T) (*Service, string) {
	t.Helper()
	root := t.TempDir()
	service, err := NewService(root, nil)
	if err != nil {
		t.Fatal(err)
	}
	return service, root
}

func readCopied(t *testing.T, path string) string {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(content)
}

// The whole point is that a new organization's agent has the baseline skills
// on disk, with their support files, where the Gateway will load them.
func TestCopyPlacesEverySkillWithItsSupportFiles(t *testing.T) {
	service, root := copyService(t)
	writeAgentSkill(t, root, "template", "cpu-report", map[string]string{
		"SKILL.md":             "cpu body",
		"references/limits.md": "limits",
	})
	writeAgentSkill(t, root, "template", "disk-report", map[string]string{"SKILL.md": "disk body"})

	result, err := service.Copy(context.Background(), CopyInput{SourceAgentID: "template", TargetAgentID: "org-1"})
	if err != nil {
		t.Fatalf("Copy: %v", err)
	}
	if len(result.Copied) != 2 || result.FileCount != 3 {
		t.Fatalf("copied %v (%d files), want both skills and 3 files", result.Copied, result.FileCount)
	}

	target := filepath.Join(root, "org-1", "skills")
	if got := readCopied(t, filepath.Join(target, "cpu-report", "SKILL.md")); got != "cpu body" {
		t.Fatalf("SKILL.md = %q", got)
	}
	if got := readCopied(t, filepath.Join(target, "cpu-report", "references", "limits.md")); got != "limits" {
		t.Fatalf("support file = %q", got)
	}
}

// An organization may have edited or retired what it inherited. Re-copying
// would undo that, so a name the target already has is left alone.
func TestCopyLeavesASkillTheTargetAlreadyHas(t *testing.T) {
	service, root := copyService(t)
	writeAgentSkill(t, root, "template", "cpu-report", map[string]string{"SKILL.md": "template body"})
	writeAgentSkill(t, root, "org-1", "cpu-report", map[string]string{"SKILL.md": "edited by the organization"})

	result, err := service.Copy(context.Background(), CopyInput{SourceAgentID: "template", TargetAgentID: "org-1"})
	if err != nil {
		t.Fatalf("Copy: %v", err)
	}
	if len(result.Copied) != 0 || len(result.Skipped) != 1 {
		t.Fatalf("copied %v skipped %v", result.Copied, result.Skipped)
	}
	if got := readCopied(t, filepath.Join(root, "org-1", "skills", "cpu-report", "SKILL.md")); got != "edited by the organization" {
		t.Fatalf("SKILL.md = %q, want the organization's own content", got)
	}
}

// A deployment that has not set up a template must still be able to provision
// agents, so a missing source is emptiness rather than failure.
func TestCopyTreatsAMissingTemplateAsNothingToDo(t *testing.T) {
	service, _ := copyService(t)

	result, err := service.Copy(context.Background(), CopyInput{SourceAgentID: "template", TargetAgentID: "org-1"})
	if err != nil {
		t.Fatalf("Copy: %v", err)
	}
	if len(result.Copied) != 0 {
		t.Fatalf("copied %v with no template", result.Copied)
	}
}

// The Gateway ignores a directory without SKILL.md, so copying it forward
// would spread the mistake into every organization.
func TestCopySkipsADirectoryThatIsNotASkill(t *testing.T) {
	service, root := copyService(t)
	writeAgentSkill(t, root, "template", "notes", map[string]string{"README.md": "not a skill"})
	writeAgentSkill(t, root, "template", "cpu-report", map[string]string{"SKILL.md": "body"})

	result, err := service.Copy(context.Background(), CopyInput{SourceAgentID: "template", TargetAgentID: "org-1"})
	if err != nil {
		t.Fatalf("Copy: %v", err)
	}
	if len(result.Copied) != 1 || result.Copied[0] != "cpu-report" {
		t.Fatalf("copied %v, want only cpu-report", result.Copied)
	}
}

// A symlink in the template could reach outside the mounted root, which is the
// one thing this server's containment rests on.
func TestCopyRefusesASymlinkInTheTemplate(t *testing.T) {
	service, root := copyService(t)
	writeAgentSkill(t, root, "template", "cpu-report", map[string]string{"SKILL.md": "body"})
	link := filepath.Join(root, "template", "skills", "cpu-report", "escape.md")
	if err := os.Symlink("/etc/passwd", link); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	if _, err := service.Copy(context.Background(), CopyInput{SourceAgentID: "template", TargetAgentID: "org-1"}); err == nil {
		t.Fatal("Copy succeeded, want a refusal")
	} else if CodeOf(err) != ErrorSymlinkRejected {
		t.Fatalf("error code = %q, want %q", CodeOf(err), ErrorSymlinkRejected)
	}

	// The refused skill must not be left half-written: the Gateway would load
	// it with files missing.
	if _, err := os.Stat(filepath.Join(root, "org-1", "skills", "cpu-report")); !os.IsNotExist(err) {
		t.Fatal("a partial copy was left behind")
	}
}

// Copying a workspace into itself would walk a tree it is writing into.
func TestCopyRefusesTheSameWorkspace(t *testing.T) {
	service, root := copyService(t)
	writeAgentSkill(t, root, "template", "cpu-report", map[string]string{"SKILL.md": "body"})

	_, err := service.Copy(context.Background(), CopyInput{SourceAgentID: "template", TargetAgentID: "template"})
	if CodeOf(err) != ErrorSameWorkspace {
		t.Fatalf("error code = %q, want %q", CodeOf(err), ErrorSameWorkspace)
	}
}

// An agent id is joined onto the workspace root, so a malformed one is refused
// before it can reach a path.
func TestCopyRefusesAnUnusableAgentID(t *testing.T) {
	service, _ := copyService(t)

	for _, input := range []CopyInput{
		{SourceAgentID: "../etc", TargetAgentID: "org-1"},
		{SourceAgentID: "template", TargetAgentID: ".."},
		{SourceAgentID: "", TargetAgentID: "org-1"},
	} {
		if _, err := service.Copy(context.Background(), input); CodeOf(err) != ErrorInvalidAgentID {
			t.Fatalf("Copy(%+v) error code = %q, want %q", input, CodeOf(err), ErrorInvalidAgentID)
		}
	}
}
