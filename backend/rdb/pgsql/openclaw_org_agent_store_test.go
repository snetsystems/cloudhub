package pgsql_test

import (
	"context"
	"errors"
	"os"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/rdb/pgsql"
)

func setupOpenClawOrgAgentStore(t *testing.T) (*pgsql.OpenClawOrgAgentStore, func()) {
	t.Helper()
	client, cleanup := setupTestDB(t)

	for _, migration := range []string{
		"migrations/009_create_openclaw_skill_authoring.sql",
		"migrations/010_soft_delete_openclaw_org_agents.sql",
		"migrations/011_openclaw_org_agent_reclaimed_at.sql",
	} {
		sql, err := os.ReadFile(migration)
		if err != nil {
			cleanup()
			t.Fatalf("read %s: %v", migration, err)
		}
		if _, err := client.ExecContext(context.Background(), string(sql)); err != nil {
			cleanup()
			t.Fatalf("run %s: %v", migration, err)
		}
	}

	store := pgsql.NewOpenClawOrgAgentStore(client)
	drop := func() {
		_, _ = client.ExecContext(context.Background(), "DELETE FROM openclaw_org_agents")
		cleanup()
	}
	return store, drop
}

func TestOpenClawOrgAgentStoreReplaceAndGet(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if err := store.Replace(ctx, "org-a", map[string]string{
		cloudhub.OpenClawAgentAuthoring: "cloudhub-authoring",
		cloudhub.OpenClawAgentExecution: "cloudhub-main",
	}); err != nil {
		t.Fatalf("replace: %v", err)
	}

	got, err := store.Get(ctx, "org-a", cloudhub.OpenClawAgentAuthoring)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got != "cloudhub-authoring" {
		t.Fatalf("agent = %q, want cloudhub-authoring", got)
	}

	// Replace is a full swap, so a purpose left out of the map disappears
	// rather than lingering from the previous mapping.
	if err := store.Replace(ctx, "org-a", map[string]string{
		cloudhub.OpenClawAgentExecution: "cloudhub-main",
	}); err != nil {
		t.Fatalf("replace again: %v", err)
	}
	if _, err := store.Get(ctx, "org-a", cloudhub.OpenClawAgentAuthoring); err != cloudhub.ErrOpenClawAgentNotMapped {
		t.Fatalf("err = %v, want ErrOpenClawAgentNotMapped", err)
	}
	if got, err := store.Get(ctx, "org-a", cloudhub.OpenClawAgentExecution); err != nil || got != "cloudhub-main" {
		t.Fatalf("execution agent = %q, %v", got, err)
	}
}

func TestOpenClawOrgAgentStoreIsolatesOrganizations(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if err := store.Replace(ctx, "org-a", map[string]string{
		cloudhub.OpenClawAgentAuthoring: "a-authoring",
	}); err != nil {
		t.Fatalf("replace: %v", err)
	}
	if _, err := store.Get(ctx, "org-b", cloudhub.OpenClawAgentAuthoring); err != cloudhub.ErrOpenClawAgentNotMapped {
		t.Fatalf("org-b err = %v, want ErrOpenClawAgentNotMapped", err)
	}

	// Replacing one organization's mapping leaves another's alone.
	if err := store.Replace(ctx, "org-b", map[string]string{
		cloudhub.OpenClawAgentAuthoring: "b-authoring",
	}); err != nil {
		t.Fatalf("replace org-b: %v", err)
	}
	got, err := store.Get(ctx, "org-a", cloudhub.OpenClawAgentAuthoring)
	if err != nil || got != "a-authoring" {
		t.Fatalf("org-a agent = %q, %v", got, err)
	}
}

func TestOpenClawOrgAgentStoreReplaceWithEmptyMapClearsTheMapping(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if err := store.Replace(ctx, "org-a", map[string]string{
		cloudhub.OpenClawAgentExecution: "cloudhub-main",
	}); err != nil {
		t.Fatalf("replace: %v", err)
	}
	if err := store.Replace(ctx, "org-a", map[string]string{}); err != nil {
		t.Fatalf("replace with empty map: %v", err)
	}
	if _, err := store.Get(ctx, "org-a", cloudhub.OpenClawAgentExecution); err != cloudhub.ErrOpenClawAgentNotMapped {
		t.Fatalf("err = %v, want ErrOpenClawAgentNotMapped", err)
	}
}

// Lazy provisioning binds an agent the first time an organization needs one.
// This fails if a second attempt overwrites the first, which would leave two
// requests pointing at different workspaces for the same organization.
func TestOpenClawOrgAgentStoreEnsureKeepsTheFirstBinding(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	first, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "cloudhub-org-a-execution")
	if err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if first != "cloudhub-org-a-execution" {
		t.Fatalf("Ensure = %q, want the agent it was given", first)
	}

	second, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "a-different-agent")
	if err != nil {
		t.Fatalf("Ensure(second): %v", err)
	}
	if second != "cloudhub-org-a-execution" {
		t.Fatalf("Ensure(second) = %q, want the already-bound agent", second)
	}

	got, err := store.Get(ctx, "org-a", cloudhub.OpenClawAgentExecution)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "cloudhub-org-a-execution" {
		t.Fatalf("Get = %q, want the first binding", got)
	}
}

// Ensure must bind one purpose without disturbing the other. Replace clears the
// whole organization, so reusing it for lazy provisioning would drop the
// authoring agent the moment an execution agent was provisioned.
func TestOpenClawOrgAgentStoreEnsureLeavesOtherPurposesAlone(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentAuthoring, "authoring-agent"); err != nil {
		t.Fatalf("Ensure(authoring): %v", err)
	}
	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "execution-agent"); err != nil {
		t.Fatalf("Ensure(execution): %v", err)
	}

	authoring, err := store.Get(ctx, "org-a", cloudhub.OpenClawAgentAuthoring)
	if err != nil || authoring != "authoring-agent" {
		t.Fatalf("authoring = %q, %v", authoring, err)
	}
	execution, err := store.Get(ctx, "org-a", cloudhub.OpenClawAgentExecution)
	if err != nil || execution != "execution-agent" {
		t.Fatalf("execution = %q, %v", execution, err)
	}
}

// Organizations must not see each other's agents even under the same purpose.
func TestOpenClawOrgAgentStoreEnsureIsolatesOrganizations(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "agent-a"); err != nil {
		t.Fatalf("Ensure(org-a): %v", err)
	}
	bound, err := store.Ensure(ctx, "org-b", cloudhub.OpenClawAgentExecution, "agent-b")
	if err != nil {
		t.Fatalf("Ensure(org-b): %v", err)
	}
	if bound != "agent-b" {
		t.Fatalf("org-b bound to %q, want agent-b", bound)
	}
}

// Retiring an organization keeps its bindings for recovery: every skill
// revision stays in CloudHub, so restoring a mapping is enough to rebuild the
// workspace the Gateway lost.
func TestOpenClawOrgAgentStoreSoftDeleteHidesButKeepsTheMapping(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if err := store.Replace(ctx, "org-a", map[string]string{
		cloudhub.OpenClawAgentAuthoring: "authoring-agent",
		cloudhub.OpenClawAgentExecution: "execution-agent",
	}); err != nil {
		t.Fatalf("Replace: %v", err)
	}
	if err := store.SoftDelete(ctx, "org-a"); err != nil {
		t.Fatalf("SoftDelete: %v", err)
	}

	if _, err := store.Get(ctx, "org-a", cloudhub.OpenClawAgentExecution); !errors.Is(err, cloudhub.ErrOpenClawAgentNotMapped) {
		t.Fatalf("Get(retired) error = %v, want ErrOpenClawAgentNotMapped", err)
	}
	all, err := store.All(ctx, "org-a")
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(all) != 0 {
		t.Fatalf("All(retired) = %#v, want empty", all)
	}
}

// The partial unique index is what allows this: without it the retired row
// would collide and an organization id could never be provisioned again.
func TestOpenClawOrgAgentStoreCanProvisionAgainAfterSoftDelete(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "first-agent"); err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if err := store.SoftDelete(ctx, "org-a"); err != nil {
		t.Fatalf("SoftDelete: %v", err)
	}

	bound, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "second-agent")
	if err != nil {
		t.Fatalf("Ensure(after soft delete): %v", err)
	}
	if bound != "second-agent" {
		t.Fatalf("Ensure = %q, want the new agent", bound)
	}
}

// All must report only the organization it was asked about.
func TestOpenClawOrgAgentStoreAllIsScopedToOneOrganization(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "agent-a"); err != nil {
		t.Fatalf("Ensure(org-a): %v", err)
	}
	if _, err := store.Ensure(ctx, "org-b", cloudhub.OpenClawAgentExecution, "agent-b"); err != nil {
		t.Fatalf("Ensure(org-b): %v", err)
	}

	all, err := store.All(ctx, "org-a")
	if err != nil {
		t.Fatalf("All: %v", err)
	}
	if len(all) != 1 || all[cloudhub.OpenClawAgentExecution] != "agent-a" {
		t.Fatalf("All(org-a) = %#v", all)
	}
}

// A mapping only becomes owed once its organization is gone. A live mapping's
// workspace is in use, so listing it would send a sweep to delete it.
func TestOpenClawOrgAgentStorePendingReclaimListsOnlyRetiredMappings(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "agent-a"); err != nil {
		t.Fatalf("Ensure(org-a): %v", err)
	}
	if _, err := store.Ensure(ctx, "org-b", cloudhub.OpenClawAgentExecution, "agent-b"); err != nil {
		t.Fatalf("Ensure(org-b): %v", err)
	}
	if err := store.SoftDelete(ctx, "org-b"); err != nil {
		t.Fatalf("SoftDelete: %v", err)
	}

	pending, err := store.PendingReclaim(ctx)
	if err != nil {
		t.Fatalf("PendingReclaim: %v", err)
	}
	if len(pending) != 1 {
		t.Fatalf("pending = %#v, want only the retired mapping", pending)
	}
	if pending[0].OrganizationID != "org-b" || pending[0].AgentID != "agent-b" {
		t.Fatalf("pending[0] = %#v", pending[0])
	}
	if pending[0].DeletedAt.IsZero() {
		t.Fatal("pending entry has no deletion time, so a sweep cannot tell how long it has been owed")
	}
}

// Marking is what takes a leftover out of the queue; without it every deleted
// organization would be swept again on every run.
func TestOpenClawOrgAgentStoreMarkReclaimedClearsTheQueue(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "agent-a"); err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentAuthoring, "agent-a-authoring"); err != nil {
		t.Fatalf("Ensure(authoring): %v", err)
	}
	if err := store.SoftDelete(ctx, "org-a"); err != nil {
		t.Fatalf("SoftDelete: %v", err)
	}

	if err := store.MarkReclaimed(ctx, "org-a", cloudhub.OpenClawAgentExecution); err != nil {
		t.Fatalf("MarkReclaimed: %v", err)
	}

	pending, err := store.PendingReclaim(ctx)
	if err != nil {
		t.Fatalf("PendingReclaim: %v", err)
	}
	// Only the purpose that was cleared leaves. Clearing the whole
	// organization would drop a workspace still on the host.
	if len(pending) != 1 || pending[0].Purpose != cloudhub.OpenClawAgentAuthoring {
		t.Fatalf("pending = %#v, want only the authoring mapping", pending)
	}
}

// A live mapping must not be markable: doing so would hide its workspace from
// every future sweep once the organization is deleted.
func TestOpenClawOrgAgentStoreMarkReclaimedIgnoresLiveMappings(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "agent-a"); err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if err := store.MarkReclaimed(ctx, "org-a", cloudhub.OpenClawAgentExecution); err != nil {
		t.Fatalf("MarkReclaimed: %v", err)
	}
	if err := store.SoftDelete(ctx, "org-a"); err != nil {
		t.Fatalf("SoftDelete: %v", err)
	}

	pending, err := store.PendingReclaim(ctx)
	if err != nil {
		t.Fatalf("PendingReclaim: %v", err)
	}
	if len(pending) != 1 {
		t.Fatalf("pending = %#v, want the mapping still owed", pending)
	}
}

// Provisioning again after a reclaim must not resurrect the retired row: the
// workspace it named is gone, so a new one has to be created and bound.
func TestOpenClawOrgAgentStoreReclaimedRowDoesNotBlockReprovisioning(t *testing.T) {
	store, done := setupOpenClawOrgAgentStore(t)
	defer done()
	ctx := context.Background()

	if _, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "old-agent"); err != nil {
		t.Fatalf("Ensure: %v", err)
	}
	if err := store.SoftDelete(ctx, "org-a"); err != nil {
		t.Fatalf("SoftDelete: %v", err)
	}
	if err := store.MarkReclaimed(ctx, "org-a", cloudhub.OpenClawAgentExecution); err != nil {
		t.Fatalf("MarkReclaimed: %v", err)
	}

	agentID, err := store.Ensure(ctx, "org-a", cloudhub.OpenClawAgentExecution, "new-agent")
	if err != nil {
		t.Fatalf("Ensure after reclaim: %v", err)
	}
	if agentID != "new-agent" {
		t.Fatalf("agentID = %q, want new-agent", agentID)
	}
}
