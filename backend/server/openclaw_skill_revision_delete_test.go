package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// Deleting a revision is guarded rather than published: the Gateway holds only
// the active revision's files, so the handler's job is to refuse the two cases
// that would leave CloudHub inconsistent and otherwise get out of the way.

// revisionDeleteStore serves a fixed history and records what was deleted.
type revisionDeleteStore struct {
	cloudhub.OpenClawSkillStore

	skill     *cloudhub.OpenClawSkill
	revisions []cloudhub.OpenClawSkillRevision
	deleted   []int
	delOrg    []string
}

func (s *revisionDeleteStore) Get(_ context.Context, _, _ string) (*cloudhub.OpenClawSkill, error) {
	return s.skill, nil
}

func (s *revisionDeleteStore) Revisions(_ context.Context, _, _ string) ([]cloudhub.OpenClawSkillRevision, error) {
	return s.revisions, nil
}

func (s *revisionDeleteStore) DeleteRevision(_ context.Context, organizationID, _ string, revision int) error {
	s.delOrg = append(s.delOrg, organizationID)
	s.deleted = append(s.deleted, revision)
	return nil
}

func newRevisionDeleteHarness(active int, revisions ...int) (*Service, *revisionDeleteStore) {
	history := []cloudhub.OpenClawSkillRevision{}
	for _, rev := range revisions {
		history = append(history, cloudhub.OpenClawSkillRevision{Revision: rev})
	}
	store := &revisionDeleteStore{
		skill: &cloudhub.OpenClawSkill{
			ID:             "skill-1",
			OrganizationID: "org-1",
			Name:           "cpu-report",
			ActiveRevision: active,
		},
		revisions: history,
	}
	return &Service{
		Store:  &mocks.Store{OpenClawSkillStore: store},
		Logger: &mocks.TestLogger{},
	}, store
}

func deleteRevision(service *Service, revision int) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodDelete,
		"/cloudhub/v2/openclaw/skills/skill-1/revisions/"+strconv.Itoa(revision), nil)
	ctx := request.Context()
	ctx = context.WithValue(ctx, organizations.ContextKey, "org-1")
	ctx = context.WithValue(ctx, UserContextKey, &cloudhub.User{ID: 9, Name: "admin"})
	ctx = httprouter.WithParams(ctx, httprouter.Params{
		{Key: "id", Value: "skill-1"},
		{Key: "rev", Value: strconv.Itoa(revision)},
	})

	recorder := httptest.NewRecorder()
	service.OpenClawSkillRevisionDelete(recorder, request.WithContext(ctx))
	return recorder
}

func TestOpenClawSkillRevisionDeleteRemovesASupersededRevision(t *testing.T) {
	service, store := newRevisionDeleteHarness(3, 3, 2, 1)

	recorder := deleteRevision(service, 2)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204; body = %s", recorder.Code, recorder.Body)
	}
	if len(store.deleted) != 1 || store.deleted[0] != 2 {
		t.Fatalf("deleted revisions = %v, want [2]", store.deleted)
	}
	// The organization is what keeps this from reaching another tenant's
	// history through a guessed skill id.
	if len(store.delOrg) != 1 || store.delOrg[0] != "org-1" {
		t.Fatalf("deleted for organizations = %v, want [org-1]", store.delOrg)
	}
}

// active_revision has no foreign key behind it, so deleting the row it names
// would leave the skill pointing at history that is gone - while the agent
// keeps running those very files.
func TestOpenClawSkillRevisionDeleteRefusesTheActiveRevision(t *testing.T) {
	service, store := newRevisionDeleteHarness(3, 3, 2, 1)

	recorder := deleteRevision(service, 3)

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", recorder.Code)
	}
	if len(store.deleted) != 0 {
		t.Fatalf("refused delete still reached the store: %v", store.deleted)
	}
}

// A skill with no revisions has no files and no description. Removing the last
// one is deleting the skill, which also has to clear the Gateway workspace.
func TestOpenClawSkillRevisionDeleteRefusesTheOnlyRevision(t *testing.T) {
	service, store := newRevisionDeleteHarness(0, 1)

	recorder := deleteRevision(service, 1)

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", recorder.Code)
	}
	if len(store.deleted) != 0 {
		t.Fatalf("refused delete still reached the store: %v", store.deleted)
	}
}

func TestOpenClawSkillRevisionDeleteRejectsANonNumericRevision(t *testing.T) {
	service, store := newRevisionDeleteHarness(3, 3, 2, 1)

	request := httptest.NewRequest(http.MethodDelete,
		"/cloudhub/v2/openclaw/skills/skill-1/revisions/latest", nil)
	ctx := request.Context()
	ctx = context.WithValue(ctx, organizations.ContextKey, "org-1")
	ctx = context.WithValue(ctx, UserContextKey, &cloudhub.User{ID: 9, Name: "admin"})
	ctx = httprouter.WithParams(ctx, httprouter.Params{
		{Key: "id", Value: "skill-1"},
		{Key: "rev", Value: "latest"},
	})

	recorder := httptest.NewRecorder()
	service.OpenClawSkillRevisionDelete(recorder, request.WithContext(ctx))

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", recorder.Code)
	}
	if len(store.deleted) != 0 {
		t.Fatalf("refused delete still reached the store: %v", store.deleted)
	}
}
