package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// A revision replaces a skill's whole file set rather than patching it, so an
// editor has to read the current files back before it can submit a change.
// The history listing deliberately omits them, which leaves this handler as
// the only way to get them.

type fakeRevisionStore struct {
	cloudhub.OpenClawSkillStore

	rev      *cloudhub.OpenClawSkillRevision
	err      error
	orgIDs   []string
	skillIDs []string
	revs     []int
}

func (s *fakeRevisionStore) Revision(_ context.Context, organizationID, skillID string, revision int) (*cloudhub.OpenClawSkillRevision, error) {
	s.orgIDs = append(s.orgIDs, organizationID)
	s.skillIDs = append(s.skillIDs, skillID)
	s.revs = append(s.revs, revision)
	if s.err != nil {
		return nil, s.err
	}
	return s.rev, nil
}

func getRevision(store *fakeRevisionStore, id, rev string) *httptest.ResponseRecorder {
	service := &Service{
		Store:  &mocks.Store{OpenClawSkillStore: store},
		Logger: &mocks.TestLogger{},
	}

	request := httptest.NewRequest(http.MethodGet, "/cloudhub/v2/openclaw/skills/"+id+"/revisions/"+rev, nil)
	ctx := request.Context()
	ctx = context.WithValue(ctx, organizations.ContextKey, "org-1")
	ctx = context.WithValue(ctx, UserContextKey, &cloudhub.User{ID: 9, Name: "admin"})
	ctx = httprouter.WithParams(ctx, httprouter.Params{
		{Key: "id", Value: id},
		{Key: "rev", Value: rev},
	})

	recorder := httptest.NewRecorder()
	service.OpenClawSkillRevisionGet(recorder, request.WithContext(ctx))
	return recorder
}

func TestOpenClawSkillRevisionGetReturnsTheFileSet(t *testing.T) {
	store := &fakeRevisionStore{
		rev: &cloudhub.OpenClawSkillRevision{
			SkillID:  "skill-1",
			Revision: 2,
			Files: []cloudhub.OpenClawSkillFile{
				{Path: "SKILL.md", Content: "---\nname: cpu-report\n---\n"},
				{Path: "scripts/collect.sh", Content: "echo hi\n"},
			},
		},
	}

	recorder := getRevision(store, "skill-1", "2")

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body)
	}

	var got cloudhub.OpenClawSkillRevision
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(got.Files) != 2 {
		t.Fatalf("files = %v, want both SKILL.md and the support file", got.Files)
	}

	// Reading another organization's revision would hand its files to a
	// caller who cannot otherwise see the skill at all.
	if store.orgIDs[0] != "org-1" {
		t.Fatalf("store call scoped to %q, want org-1", store.orgIDs[0])
	}
	if store.skillIDs[0] != "skill-1" || store.revs[0] != 2 {
		t.Fatalf("asked for %s@%d, want skill-1@2", store.skillIDs[0], store.revs[0])
	}
}

func TestOpenClawSkillRevisionGetRejectsANonNumericRevision(t *testing.T) {
	store := &fakeRevisionStore{}

	recorder := getRevision(store, "skill-1", "latest")

	if recorder.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", recorder.Code)
	}
	if len(store.revs) != 0 {
		t.Fatal("the store was queried with an unparsed revision")
	}
}

func TestOpenClawSkillRevisionGetReportsAMissingRevisionAsNotFound(t *testing.T) {
	store := &fakeRevisionStore{err: cloudhub.ErrOpenClawSkillNotFound}

	recorder := getRevision(store, "skill-1", "7")

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body = %s", recorder.Code, recorder.Body)
	}
}

func TestOpenClawSkillRevisionGetRequiresAnOrganizationContext(t *testing.T) {
	store := &fakeRevisionStore{err: errors.New("should not be called")}
	service := &Service{
		Store:  &mocks.Store{OpenClawSkillStore: store},
		Logger: &mocks.TestLogger{},
	}

	request := httptest.NewRequest(http.MethodGet, "/cloudhub/v2/openclaw/skills/skill-1/revisions/1", nil)
	recorder := httptest.NewRecorder()
	service.OpenClawSkillRevisionGet(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", recorder.Code)
	}
}
