package organizations_test

import (
	"context"
	"testing"

	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// recordingSkillStore captures the organization each call was given, so a test
// can prove the wrapper substituted its own rather than trusting the caller's.
type recordingSkillStore struct {
	gotOrganization string
}

func (s *recordingSkillStore) List(_ context.Context, organizationID string) ([]cloudhub.OpenClawSkill, error) {
	s.gotOrganization = organizationID
	return nil, nil
}

func (s *recordingSkillStore) Get(_ context.Context, organizationID, _ string) (*cloudhub.OpenClawSkill, error) {
	s.gotOrganization = organizationID
	return &cloudhub.OpenClawSkill{}, nil
}

func (s *recordingSkillStore) Create(_ context.Context, skill *cloudhub.OpenClawSkill, _ *cloudhub.OpenClawSkillRevision) (*cloudhub.OpenClawSkill, error) {
	s.gotOrganization = skill.OrganizationID
	return skill, nil
}

func (s *recordingSkillStore) AddRevision(_ context.Context, organizationID, _ string, rev *cloudhub.OpenClawSkillRevision) (*cloudhub.OpenClawSkillRevision, error) {
	s.gotOrganization = organizationID
	return rev, nil
}

func (s *recordingSkillStore) Revisions(_ context.Context, organizationID, _ string) ([]cloudhub.OpenClawSkillRevision, error) {
	s.gotOrganization = organizationID
	return nil, nil
}

func (s *recordingSkillStore) Revision(_ context.Context, organizationID, _ string, _ int) (*cloudhub.OpenClawSkillRevision, error) {
	s.gotOrganization = organizationID
	return &cloudhub.OpenClawSkillRevision{}, nil
}

func (s *recordingSkillStore) UpdateRevisionReview(_ context.Context, organizationID, _ string, _ int, _ cloudhub.OpenClawSkillReview) error {
	s.gotOrganization = organizationID
	return nil
}

func (s *recordingSkillStore) SetActiveRevision(_ context.Context, organizationID, _ string, _ int) error {
	s.gotOrganization = organizationID
	return nil
}

func (s *recordingSkillStore) Delete(_ context.Context, organizationID, _ string) error {
	s.gotOrganization = organizationID
	return nil
}

func (s *recordingSkillStore) DeleteRevision(_ context.Context, organizationID, _ string, _ int) error {
	s.gotOrganization = organizationID
	return nil
}

func ownOrgContext() context.Context {
	return context.WithValue(context.Background(), organizations.ContextKey, "own-org")
}

func TestOpenClawSkillStoreSubstitutesTheOrganization(t *testing.T) {
	ctx := ownOrgContext()

	cases := []struct {
		name string
		call func(*organizations.OpenClawSkillStore) error
	}{
		{"List", func(s *organizations.OpenClawSkillStore) error {
			_, err := s.List(ctx, "attacker-org")
			return err
		}},
		{"Get", func(s *organizations.OpenClawSkillStore) error {
			_, err := s.Get(ctx, "attacker-org", "skill-1")
			return err
		}},
		{"AddRevision", func(s *organizations.OpenClawSkillStore) error {
			_, err := s.AddRevision(ctx, "attacker-org", "skill-1", &cloudhub.OpenClawSkillRevision{})
			return err
		}},
		{"Revisions", func(s *organizations.OpenClawSkillStore) error {
			_, err := s.Revisions(ctx, "attacker-org", "skill-1")
			return err
		}},
		{"Revision", func(s *organizations.OpenClawSkillStore) error {
			_, err := s.Revision(ctx, "attacker-org", "skill-1", 1)
			return err
		}},
		{"UpdateRevisionReview", func(s *organizations.OpenClawSkillStore) error {
			return s.UpdateRevisionReview(ctx, "attacker-org", "skill-1", 1, cloudhub.OpenClawSkillReview{})
		}},
		{"SetActiveRevision", func(s *organizations.OpenClawSkillStore) error {
			return s.SetActiveRevision(ctx, "attacker-org", "skill-1", 1)
		}},
		{"Delete", func(s *organizations.OpenClawSkillStore) error {
			return s.Delete(ctx, "attacker-org", "skill-1")
		}},
		{"DeleteRevision", func(s *organizations.OpenClawSkillStore) error {
			return s.DeleteRevision(ctx, "attacker-org", "skill-1", 1)
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			inner := &recordingSkillStore{}
			store := organizations.NewOpenClawSkillStore(inner, "own-org")
			if err := tc.call(store); err != nil {
				t.Fatalf("%s: %v", tc.name, err)
			}
			if inner.gotOrganization != "own-org" {
				t.Fatalf("%s passed through %q, want own-org", tc.name, inner.gotOrganization)
			}
		})
	}
}

func TestOpenClawSkillStoreRewritesTheSkillOrganizationOnCreate(t *testing.T) {
	inner := &recordingSkillStore{}
	store := organizations.NewOpenClawSkillStore(inner, "own-org")

	skill := &cloudhub.OpenClawSkill{OrganizationID: "attacker-org"}
	if _, err := store.Create(ownOrgContext(), skill, &cloudhub.OpenClawSkillRevision{}); err != nil {
		t.Fatalf("create: %v", err)
	}
	if skill.OrganizationID != "own-org" {
		t.Fatalf("skill organization = %q, want own-org", skill.OrganizationID)
	}
	if inner.gotOrganization != "own-org" {
		t.Fatalf("inner saw %q, want own-org", inner.gotOrganization)
	}
}

func TestOpenClawSkillStoreRejectsMissingOrganizationContext(t *testing.T) {
	store := organizations.NewOpenClawSkillStore(&recordingSkillStore{}, "own-org")
	if _, err := store.List(context.Background(), "own-org"); err == nil {
		t.Fatal("list without organization context succeeded, want error")
	}
}

type recordingOrgAgentStore struct {
	gotOrganization string
	pending         []cloudhub.OpenClawPendingReclaim
}

func (s *recordingOrgAgentStore) Get(_ context.Context, organizationID, _ string) (string, error) {
	s.gotOrganization = organizationID
	return "agent", nil
}

func (s *recordingOrgAgentStore) Replace(_ context.Context, organizationID string, _ map[string]string) error {
	s.gotOrganization = organizationID
	return nil
}

func (s *recordingOrgAgentStore) Ensure(_ context.Context, organizationID, _, agentID string) (string, error) {
	s.gotOrganization = organizationID
	return agentID, nil
}

func (s *recordingOrgAgentStore) All(_ context.Context, organizationID string) (map[string]string, error) {
	s.gotOrganization = organizationID
	return map[string]string{}, nil
}

func (s *recordingOrgAgentStore) SoftDelete(_ context.Context, organizationID string) error {
	s.gotOrganization = organizationID
	return nil
}

func (s *recordingOrgAgentStore) PendingReclaim(context.Context) ([]cloudhub.OpenClawPendingReclaim, error) {
	return s.pending, nil
}

func (s *recordingOrgAgentStore) MarkReclaimed(_ context.Context, organizationID, _ string) error {
	s.gotOrganization = organizationID
	return nil
}

func TestOpenClawOrgAgentStoreSubstitutesTheOrganization(t *testing.T) {
	inner := &recordingOrgAgentStore{}
	store := organizations.NewOpenClawOrgAgentStore(inner, "own-org")
	ctx := ownOrgContext()

	if _, err := store.Get(ctx, "attacker-org", cloudhub.OpenClawAgentExecution); err != nil {
		t.Fatalf("get: %v", err)
	}
	if inner.gotOrganization != "own-org" {
		t.Fatalf("get passed through %q, want own-org", inner.gotOrganization)
	}

	inner.gotOrganization = ""
	if err := store.Replace(ctx, "attacker-org", map[string]string{}); err != nil {
		t.Fatalf("replace: %v", err)
	}
	if inner.gotOrganization != "own-org" {
		t.Fatalf("replace passed through %q, want own-org", inner.gotOrganization)
	}

	// Every write has to be substituted the same way, or one of them becomes a
	// way to reach another organization's mapping.
	writes := map[string]func() error{
		"ensure": func() error {
			_, err := store.Ensure(ctx, "attacker-org", cloudhub.OpenClawAgentExecution, "agent")
			return err
		},
		"all": func() error {
			_, err := store.All(ctx, "attacker-org")
			return err
		},
		"softDelete":    func() error { return store.SoftDelete(ctx, "attacker-org") },
		"markReclaimed": func() error { return store.MarkReclaimed(ctx, "attacker-org", cloudhub.OpenClawAgentExecution) },
	}
	for name, call := range writes {
		inner.gotOrganization = ""
		if err := call(); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if inner.gotOrganization != "own-org" {
			t.Fatalf("%s passed through %q, want own-org", name, inner.gotOrganization)
		}
	}
}

// PendingReclaim spans organizations in the underlying store. Scoped, it must
// hand back only the caller's own, or it becomes a listing of every
// organization's agent ids.
func TestOpenClawOrgAgentStoreFiltersPendingReclaimToItsOwnOrganization(t *testing.T) {
	inner := &recordingOrgAgentStore{pending: []cloudhub.OpenClawPendingReclaim{
		{OrganizationID: "own-org", Purpose: cloudhub.OpenClawAgentExecution, AgentID: "mine"},
		{OrganizationID: "other-org", Purpose: cloudhub.OpenClawAgentExecution, AgentID: "theirs"},
	}}
	store := organizations.NewOpenClawOrgAgentStore(inner, "own-org")

	pending, err := store.PendingReclaim(ownOrgContext())
	if err != nil {
		t.Fatalf("pending reclaim: %v", err)
	}
	if len(pending) != 1 || pending[0].AgentID != "mine" {
		t.Fatalf("pending = %#v, want only own-org's", pending)
	}
}

func TestOpenClawOrgAgentStoreRejectsMissingOrganizationContext(t *testing.T) {
	store := organizations.NewOpenClawOrgAgentStore(&recordingOrgAgentStore{}, "own-org")
	if _, err := store.Get(context.Background(), "own-org", cloudhub.OpenClawAgentExecution); err == nil {
		t.Fatal("get without organization context succeeded, want error")
	}
}
