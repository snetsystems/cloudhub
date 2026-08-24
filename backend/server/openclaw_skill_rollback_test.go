package server

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	"github.com/snetsystems/cloudhub/backend/mocks"
	"github.com/snetsystems/cloudhub/backend/organizations"
)

// Rolling back moves the skill's active-revision pointer. It used to copy the
// chosen revision forward as a new one, which stored a revision identical to
// an existing one — the very thing a normal submit is refused for.

type fakeRollbackStore struct {
	cloudhub.OpenClawSkillStore

	skill     *cloudhub.OpenClawSkill
	revisions map[int]*cloudhub.OpenClawSkillRevision

	added        []*cloudhub.OpenClawSkillRevision
	activated    []int
	reviewedRevs []int
}

func (s *fakeRollbackStore) Get(context.Context, string, string) (*cloudhub.OpenClawSkill, error) {
	return s.skill, nil
}

func (s *fakeRollbackStore) Revision(_ context.Context, _, _ string, revision int) (*cloudhub.OpenClawSkillRevision, error) {
	rev, ok := s.revisions[revision]
	if !ok {
		return nil, cloudhub.ErrOpenClawSkillNotFound
	}
	return rev, nil
}

func (s *fakeRollbackStore) AddRevision(_ context.Context, _, _ string, rev *cloudhub.OpenClawSkillRevision) (*cloudhub.OpenClawSkillRevision, error) {
	s.added = append(s.added, rev)
	return rev, nil
}

func (s *fakeRollbackStore) SetActiveRevision(_ context.Context, _, _ string, revision int) error {
	s.activated = append(s.activated, revision)
	return nil
}

func (s *fakeRollbackStore) UpdateRevisionReview(_ context.Context, _, _ string, revision int, _ cloudhub.OpenClawSkillReview) error {
	s.reviewedRevs = append(s.reviewedRevs, revision)
	return nil
}

func rollbackSkill(store *fakeRollbackStore, publisher openClawSkillPublisher, body string) *httptest.ResponseRecorder {
	service := &Service{
		Store: &mocks.Store{
			OpenClawSkillStore:    store,
			OpenClawOrgAgentStore: &fakeOrgAgentStore{agentID: "agent-exec"},
		},
		OpenClawSkillPublisher: publisher,
		Logger:                 &mocks.TestLogger{},
	}

	request := httptest.NewRequest(http.MethodPost,
		"/cloudhub/v2/openclaw/skills/skill-1/rollback", bytes.NewBufferString(body))
	ctx := request.Context()
	ctx = context.WithValue(ctx, organizations.ContextKey, "org-1")
	ctx = context.WithValue(ctx, UserContextKey, &cloudhub.User{ID: 9, Name: "admin"})
	ctx = httprouter.WithParams(ctx, httprouter.Params{{Key: "id", Value: "skill-1"}})

	recorder := httptest.NewRecorder()
	service.OpenClawSkillRollback(recorder, request.WithContext(ctx))
	return recorder
}

func rollbackFixture() *fakeRollbackStore {
	files := []cloudhub.OpenClawSkillFile{{Path: "SKILL.md", Content: testSkillBody}}
	return &fakeRollbackStore{
		skill: &cloudhub.OpenClawSkill{ID: "skill-1", Name: "cpu-report", ActiveRevision: 2},
		revisions: map[int]*cloudhub.OpenClawSkillRevision{
			1: {Revision: 1, ReviewStatus: cloudhub.OpenClawReviewApproved, Files: files},
			2: {Revision: 2, ReviewStatus: cloudhub.OpenClawReviewApproved, Files: files},
			3: {Revision: 3, ReviewStatus: cloudhub.OpenClawReviewPending, Files: files},
		},
	}
}

func TestOpenClawRollbackMovesThePointerWithoutAddingARevision(t *testing.T) {
	store := rollbackFixture()
	publisher := &stubPublisher{}

	recorder := rollbackSkill(store, publisher, `{"toRevision":1}`)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", recorder.Code, recorder.Body)
	}
	if len(store.added) != 0 {
		t.Fatalf("a revision was added: %+v", store.added)
	}
	if len(store.activated) != 1 || store.activated[0] != 1 {
		t.Fatalf("activated = %v, want [1]", store.activated)
	}
	// The revision keeps the approval record it earned when it was first
	// applied; re-activating it is not a new review.
	if len(store.reviewedRevs) != 0 {
		t.Fatalf("the review record was rewritten for %v", store.reviewedRevs)
	}
	// The Gateway still has to receive the files: its apply writes by name and
	// cannot select an older version.
	if len(publisher.published) != 1 || publisher.agents[0] != "agent-exec" {
		t.Fatalf("published = %+v to %v", publisher.published, publisher.agents)
	}
}

// A failed publish must leave the pointer where it was, or CloudHub would
// claim a revision is live that the agent never received.
func TestOpenClawRollbackKeepsThePointerWhenPublishFails(t *testing.T) {
	store := rollbackFixture()

	recorder := rollbackSkill(store, &stubPublisher{err: errors.New("gateway down")}, `{"toRevision":1}`)

	if recorder.Code == http.StatusOK {
		t.Fatalf("status = %d, want a failure", recorder.Code)
	}
	if len(store.activated) != 0 {
		t.Fatalf("the pointer moved to %v despite the publish failing", store.activated)
	}
}

func TestOpenClawRollbackRejectsUnusableTargets(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "already live", body: `{"toRevision":2}`},
		{name: "never approved", body: `{"toRevision":3}`},
		{name: "not a revision number", body: `{"toRevision":0}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			store := rollbackFixture()
			publisher := &stubPublisher{}

			recorder := rollbackSkill(store, publisher, test.body)

			if recorder.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status = %d, want 422; body = %s", recorder.Code, recorder.Body)
			}
			if len(publisher.published) != 0 || len(store.activated) != 0 {
				t.Fatal("the Gateway was called for a target that should have been refused")
			}
		})
	}
}
