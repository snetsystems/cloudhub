package pgsql_test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func setupOpenClawSkillStore(t *testing.T) (*pgsql.OpenClawSkillStore, func()) {
	t.Helper()
	client, cleanup := setupTestDB(t)

	// The store reads next_revision, so the migration that adds it has to run
	// here too - the schema these tests exercise is the deployed one.
	for _, name := range []string{
		"migrations/009_create_openclaw_skill_authoring.sql",
		"migrations/013_openclaw_skill_next_revision.sql",
	} {
		sql, err := os.ReadFile(name)
		if err != nil {
			cleanup()
			t.Fatalf("read %s: %v", name, err)
		}
		if _, err := client.ExecContext(context.Background(), string(sql)); err != nil {
			cleanup()
			t.Fatalf("run %s: %v", name, err)
		}
	}

	store := pgsql.NewOpenClawSkillStore(client)
	drop := func() {
		_, _ = client.ExecContext(context.Background(), "DELETE FROM openclaw_skills")
		cleanup()
	}
	return store, drop
}

func newTestRevision(id string, files []cloudhub.OpenClawSkillFile) *cloudhub.OpenClawSkillRevision {
	return &cloudhub.OpenClawSkillRevision{
		ID:           id,
		TreeHash:     "hash-" + id,
		Goal:         "goal",
		AuthorID:     "1",
		ReviewStatus: cloudhub.OpenClawReviewPending,
		CreatedAt:    time.Now().UTC(),
		Files:        files,
	}
}

func newTestSkill(id, name string) *cloudhub.OpenClawSkill {
	now := time.Now().UTC()
	return &cloudhub.OpenClawSkill{
		ID:             id,
		OrganizationID: "org-a",
		Name:           name,
		Status:         cloudhub.OpenClawSkillDraft,
		CreatedBy:      "1",
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func mainOnly(content string) []cloudhub.OpenClawSkillFile {
	return []cloudhub.OpenClawSkillFile{
		{Path: "SKILL.md", Content: content, ContentHash: "h-" + content, SizeBytes: len(content)},
	}
}

func TestOpenClawSkillStoreCreateAndGet(t *testing.T) {
	store, done := setupOpenClawSkillStore(t)
	defer done()
	ctx := context.Background()

	skill := newTestSkill("11111111-1111-1111-1111-111111111111", "cpu-report")
	rev := newTestRevision("22222222-2222-2222-2222-222222222222", []cloudhub.OpenClawSkillFile{
		{Path: "SKILL.md", Content: "body", ContentHash: "h1", SizeBytes: 4},
		{Path: "scripts/collect.sh", Content: "echo hi", ContentHash: "h2", SizeBytes: 7},
	})

	if _, err := store.Create(ctx, skill, rev); err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := store.Get(ctx, "org-a", skill.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Name != "cpu-report" || got.Status != cloudhub.OpenClawSkillDraft {
		t.Fatalf("got %+v", got)
	}
	if got.ActiveRevision != 0 {
		t.Fatalf("a new skill has active revision %d, want 0", got.ActiveRevision)
	}

	revs, err := store.Revisions(ctx, "org-a", skill.ID)
	if err != nil {
		t.Fatalf("revisions: %v", err)
	}
	if len(revs) != 1 || revs[0].Revision != 1 {
		t.Fatalf("revisions = %+v", revs)
	}

	full, err := store.Revision(ctx, "org-a", skill.ID, 1)
	if err != nil {
		t.Fatalf("revision: %v", err)
	}
	if len(full.Files) != 2 {
		t.Fatalf("files = %+v", full.Files)
	}
	if full.Files[0].Path != "SKILL.md" {
		t.Fatalf("files not sorted by path: %+v", full.Files)
	}
	if full.Files[1].Content != "echo hi" {
		t.Fatalf("support file content = %q", full.Files[1].Content)
	}
}

func TestOpenClawSkillStoreRevisionsAreImmutable(t *testing.T) {
	store, done := setupOpenClawSkillStore(t)
	defer done()
	ctx := context.Background()

	skill := newTestSkill("33333333-3333-3333-3333-333333333333", "cpu-report")
	if _, err := store.Create(ctx, skill, newTestRevision("44444444-4444-4444-4444-444444444444", mainOnly("v1"))); err != nil {
		t.Fatalf("create: %v", err)
	}

	second := newTestRevision("55555555-5555-5555-5555-555555555555", mainOnly("v2"))
	added, err := store.AddRevision(ctx, "org-a", skill.ID, second)
	if err != nil {
		t.Fatalf("add revision: %v", err)
	}
	if added.Revision != 2 {
		t.Fatalf("revision = %d, want 2", added.Revision)
	}

	old, err := store.Revision(ctx, "org-a", skill.ID, 1)
	if err != nil {
		t.Fatalf("revision 1: %v", err)
	}
	if old.Files[0].Content != "v1" {
		t.Fatalf("revision 1 content changed: %q", old.Files[0].Content)
	}
}

func TestOpenClawSkillStoreIsolatesOrganizations(t *testing.T) {
	store, done := setupOpenClawSkillStore(t)
	defer done()
	ctx := context.Background()

	skill := newTestSkill("66666666-6666-6666-6666-666666666666", "cpu-report")
	if _, err := store.Create(ctx, skill, newTestRevision("77777777-7777-7777-7777-777777777777", mainOnly("v1"))); err != nil {
		t.Fatalf("create: %v", err)
	}

	if _, err := store.Get(ctx, "org-b", skill.ID); err != cloudhub.ErrOpenClawSkillNotFound {
		t.Fatalf("cross-organization get err = %v, want ErrOpenClawSkillNotFound", err)
	}
	list, err := store.List(ctx, "org-b")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("org-b sees %d skills, want 0", len(list))
	}
	if _, err := store.Revision(ctx, "org-b", skill.ID, 1); err != cloudhub.ErrOpenClawSkillNotFound {
		t.Fatalf("cross-organization revision err = %v, want ErrOpenClawSkillNotFound", err)
	}
	if err := store.Delete(ctx, "org-b", skill.ID); err != cloudhub.ErrOpenClawSkillNotFound {
		t.Fatalf("cross-organization delete err = %v, want ErrOpenClawSkillNotFound", err)
	}
	if err := store.DeleteRevision(ctx, "org-b", skill.ID, 1); err != cloudhub.ErrOpenClawSkillNotFound {
		t.Fatalf("cross-organization revision delete err = %v, want ErrOpenClawSkillNotFound", err)
	}
}

func TestOpenClawSkillStoreDeleteFreesTheNameAndTakesTheHistory(t *testing.T) {
	store, done := setupOpenClawSkillStore(t)
	defer done()
	ctx := context.Background()

	first := newTestSkill("88888888-8888-8888-8888-888888888888", "cpu-report")
	if _, err := store.Create(ctx, first, newTestRevision("99999999-9999-9999-9999-999999999999", mainOnly("v1"))); err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := store.Delete(ctx, "org-a", first.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}

	list, err := store.List(ctx, "org-a")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("deleted skill still listed: %+v", list)
	}

	second := newTestSkill("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "cpu-report")
	if _, err := store.Create(ctx, second, newTestRevision("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", mainOnly("v1"))); err != nil {
		t.Fatalf("reuse name after delete: %v", err)
	}

	// The revisions cascade with the skill, so nothing of the first one is
	// left behind under a name a second skill now holds.
	revs, err := store.Revisions(ctx, "org-a", first.ID)
	if err != nil {
		t.Fatalf("revisions of deleted skill: %v", err)
	}
	if len(revs) != 0 {
		t.Fatalf("delete left revision history behind: %+v", revs)
	}
}

func TestOpenClawSkillStoreDeleteRevisionKeepsTheRestAndDoesNotReuseTheNumber(t *testing.T) {
	store, done := setupOpenClawSkillStore(t)
	defer done()
	ctx := context.Background()

	skill := newTestSkill("11111111-2222-3333-4444-555555555555", "cpu-report")
	if _, err := store.Create(ctx, skill, newTestRevision("11111111-2222-3333-4444-555555555556", mainOnly("v1"))); err != nil {
		t.Fatalf("create: %v", err)
	}
	for i, id := range []string{
		"11111111-2222-3333-4444-555555555557",
		"11111111-2222-3333-4444-555555555558",
	} {
		if _, err := store.AddRevision(ctx, "org-a", skill.ID, newTestRevision(id, mainOnly(fmt.Sprintf("v%d", i+2)))); err != nil {
			t.Fatalf("add revision %d: %v", i+2, err)
		}
	}

	if err := store.DeleteRevision(ctx, "org-a", skill.ID, 2); err != nil {
		t.Fatalf("delete revision: %v", err)
	}

	revs, err := store.Revisions(ctx, "org-a", skill.ID)
	if err != nil {
		t.Fatalf("revisions: %v", err)
	}
	got := []int{}
	for _, rev := range revs {
		got = append(got, rev.Revision)
	}
	if len(got) != 2 || got[0] != 3 || got[1] != 1 {
		t.Fatalf("revisions after delete = %v, want [3 1]", got)
	}

	if _, err := store.Revision(ctx, "org-a", skill.ID, 2); err != cloudhub.ErrOpenClawSkillNotFound {
		t.Fatalf("deleted revision err = %v, want ErrOpenClawSkillNotFound", err)
	}

	// The gap stays a gap. Handing 2 to different content would make an
	// earlier reference to "revision 2" point at something it never described.
	added, err := store.AddRevision(ctx, "org-a", skill.ID, newTestRevision("11111111-2222-3333-4444-555555555559", mainOnly("v4")))
	if err != nil {
		t.Fatalf("add revision after delete: %v", err)
	}
	if added.Revision != 4 {
		t.Fatalf("next revision = %d, want 4", added.Revision)
	}

	// Deleting the highest revision is the case a MAX(revision) + 1 counter
	// gets wrong: the number would drop back and the next revision would take
	// one that has already been used.
	if err := store.DeleteRevision(ctx, "org-a", skill.ID, 4); err != nil {
		t.Fatalf("delete highest revision: %v", err)
	}
	after, err := store.AddRevision(ctx, "org-a", skill.ID, newTestRevision("11111111-2222-3333-4444-55555555555a", mainOnly("v5")))
	if err != nil {
		t.Fatalf("add revision after deleting the highest: %v", err)
	}
	if after.Revision != 5 {
		t.Fatalf("next revision after deleting the highest = %d, want 5", after.Revision)
	}

	if err := store.DeleteRevision(ctx, "org-a", skill.ID, 2); err != cloudhub.ErrOpenClawSkillNotFound {
		t.Fatalf("second delete err = %v, want ErrOpenClawSkillNotFound", err)
	}
}

func TestOpenClawSkillStoreReviewAndActivate(t *testing.T) {
	store, done := setupOpenClawSkillStore(t)
	defer done()
	ctx := context.Background()

	skill := newTestSkill("cccccccc-cccc-cccc-cccc-cccccccccccc", "cpu-report")
	if _, err := store.Create(ctx, skill, newTestRevision("dddddddd-dddd-dddd-dddd-dddddddddddd", mainOnly("v1"))); err != nil {
		t.Fatalf("create: %v", err)
	}

	review := cloudhub.OpenClawSkillReview{
		Status:     cloudhub.OpenClawReviewApproved,
		ReviewedBy: "9",
		ReviewedAt: time.Now().UTC(),
		Note:       "ok",
		ProposalID: "cpu-report-20260821-abc",
		Scan:       []byte(`{"state":"clean"}`),
	}
	if err := store.UpdateRevisionReview(ctx, "org-a", skill.ID, 1, review); err != nil {
		t.Fatalf("update review: %v", err)
	}
	if err := store.SetActiveRevision(ctx, "org-a", skill.ID, 1); err != nil {
		t.Fatalf("set active: %v", err)
	}

	got, err := store.Get(ctx, "org-a", skill.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.ActiveRevision != 1 || got.Status != cloudhub.OpenClawSkillApproved {
		t.Fatalf("got %+v", got)
	}

	rev, err := store.Revision(ctx, "org-a", skill.ID, 1)
	if err != nil {
		t.Fatalf("revision: %v", err)
	}
	if rev.ReviewStatus != cloudhub.OpenClawReviewApproved ||
		rev.ReviewedBy != "9" ||
		rev.GatewayProposalID != "cpu-report-20260821-abc" {
		t.Fatalf("review not persisted: %+v", rev)
	}
	if rev.ReviewedAt == nil {
		t.Fatal("reviewedAt not persisted")
	}
	// jsonb normalizes whitespace and key order, so the scan round-trips by
	// value rather than byte for byte. That is enough: the scan is stored to
	// be read back and shown, never to be compared as text.
	var scan map[string]string
	if err := json.Unmarshal(rev.GatewayScan, &scan); err != nil {
		t.Fatalf("scan not stored as JSON: %v (%s)", err, rev.GatewayScan)
	}
	if scan["state"] != "clean" {
		t.Fatalf("scan = %v", scan)
	}
}

func TestOpenClawSkillStoreRejectsRevisionOnMissingSkill(t *testing.T) {
	store, done := setupOpenClawSkillStore(t)
	defer done()
	ctx := context.Background()

	_, err := store.AddRevision(ctx, "org-a", "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
		newTestRevision("ffffffff-ffff-ffff-ffff-ffffffffffff", mainOnly("v1")))
	if err != cloudhub.ErrOpenClawSkillNotFound {
		t.Fatalf("err = %v, want ErrOpenClawSkillNotFound", err)
	}
}
