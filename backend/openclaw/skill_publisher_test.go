package openclaw

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

type fakeSkillRPC struct {
	calls    []string
	params   []json.RawMessage
	response map[string]json.RawMessage
	err      map[string]error
}

func (f *fakeSkillRPC) Call(_ context.Context, method string, params interface{}) (json.RawMessage, error) {
	f.calls = append(f.calls, method)
	encoded, _ := json.Marshal(params)
	f.params = append(f.params, encoded)
	if err, ok := f.err[method]; ok {
		return nil, err
	}
	return f.response[method], nil
}

func newFakeSkillRPC() *fakeSkillRPC {
	return &fakeSkillRPC{
		response: map[string]json.RawMessage{
			"skills.status": json.RawMessage(`{"skills":[]}`),
			"skills.proposals.create": json.RawMessage(
				`{"record":{"id":"cpu-report-20260821-abc","scan":{"state":"clean","critical":0}}}`),
			"skills.proposals.update": json.RawMessage(
				`{"record":{"id":"cpu-report-20260821-def","scan":{"state":"clean","critical":0}}}`),
			"skills.proposals.apply": json.RawMessage(`{"record":{"status":"applied"}}`),
			"skills.update":          json.RawMessage(`{}`),
		},
		err: map[string]error{},
	}
}

func (f *fakeSkillRPC) paramsFor(t *testing.T, method string, out interface{}) {
	t.Helper()
	for i, call := range f.calls {
		if call == method {
			if err := json.Unmarshal(f.params[i], out); err != nil {
				t.Fatalf("decode %s params: %v", method, err)
			}
			return
		}
	}
	t.Fatalf("%s was never called; calls = %v", method, f.calls)
}

func TestSkillPublisherCreatesWhenTheSkillIsNew(t *testing.T) {
	rpc := newFakeSkillRPC()
	rpc.response["skills.status"] = json.RawMessage(`{"skills":[{"name":"other"}]}`)

	result, err := NewSkillPublisher(rpc).Publish(context.Background(), "agent-1", SkillPayload{
		Name: "cpu-report", Description: "d", Main: "body",
		Support: []SkillFile{{Path: "scripts/collect.sh", Content: "echo hi"}},
	})
	if err != nil {
		t.Fatalf("publish: %v", err)
	}
	if result.ProposalID != "cpu-report-20260821-abc" {
		t.Fatalf("proposal id = %q", result.ProposalID)
	}
	var scan map[string]interface{}
	if err := json.Unmarshal(result.Scan, &scan); err != nil {
		t.Fatalf("scan not captured: %v", err)
	}
	if scan["state"] != "clean" {
		t.Fatalf("scan = %v", scan)
	}

	want := []string{"skills.status", "skills.proposals.create", "skills.proposals.apply"}
	if len(rpc.calls) != len(want) {
		t.Fatalf("calls = %v, want %v", rpc.calls, want)
	}
	for i := range want {
		if rpc.calls[i] != want[i] {
			t.Fatalf("calls = %v, want %v", rpc.calls, want)
		}
	}

	var created struct {
		AgentID      string `json:"agentId"`
		Name         string `json:"name"`
		Description  string `json:"description"`
		Content      string `json:"content"`
		SupportFiles []struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		} `json:"supportFiles"`
	}
	rpc.paramsFor(t, "skills.proposals.create", &created)
	if created.AgentID != "agent-1" || created.Name != "cpu-report" ||
		created.Description != "d" || created.Content != "body" {
		t.Fatalf("create params = %+v", created)
	}
	if len(created.SupportFiles) != 1 ||
		created.SupportFiles[0].Path != "scripts/collect.sh" ||
		created.SupportFiles[0].Content != "echo hi" {
		t.Fatalf("support files = %+v", created.SupportFiles)
	}

	var applied struct {
		ProposalID string `json:"proposalId"`
		AgentID    string `json:"agentId"`
	}
	rpc.paramsFor(t, "skills.proposals.apply", &applied)
	if applied.ProposalID != "cpu-report-20260821-abc" || applied.AgentID != "agent-1" {
		t.Fatalf("apply params = %+v", applied)
	}
}

func TestSkillPublisherUpdatesWhenTheSkillExists(t *testing.T) {
	rpc := newFakeSkillRPC()
	rpc.response["skills.status"] = json.RawMessage(`{"skills":[{"name":"cpu-report"}]}`)

	result, err := NewSkillPublisher(rpc).Publish(context.Background(), "agent-1", SkillPayload{
		Name: "cpu-report", Description: "d", Main: "body",
	})
	if err != nil {
		t.Fatalf("publish: %v", err)
	}
	if result.ProposalID != "cpu-report-20260821-def" {
		t.Fatalf("proposal id = %q", result.ProposalID)
	}
	if rpc.calls[1] != "skills.proposals.update" {
		t.Fatalf("calls = %v, want update second", rpc.calls)
	}

	var updated struct {
		SkillName   string `json:"skillName"`
		Description string `json:"description"`
		Content     string `json:"content"`
		AgentID     string `json:"agentId"`
	}
	rpc.paramsFor(t, "skills.proposals.update", &updated)
	if updated.SkillName != "cpu-report" || updated.Content != "body" || updated.AgentID != "agent-1" {
		t.Fatalf("update params = %+v", updated)
	}
	// Omitting it kept whatever the skill was created with, so a revision that
	// rewrote the description published a file still describing version one —
	// and the description is what an agent reads to pick a skill at all.
	if updated.Description != "d" {
		t.Fatalf("update sent description %q, want the revision's own", updated.Description)
	}
}

func TestSkillPublisherDoesNotApplyWhenTheProposalFails(t *testing.T) {
	rpc := newFakeSkillRPC()
	rpc.err["skills.proposals.create"] = errors.New("boom")

	if _, err := NewSkillPublisher(rpc).Publish(context.Background(), "agent-1", SkillPayload{
		Name: "cpu-report", Description: "d", Main: "body",
	}); err == nil {
		t.Fatal("publish succeeded, want error")
	}
	for _, call := range rpc.calls {
		if call == "skills.proposals.apply" {
			t.Fatal("apply was called after a failed proposal")
		}
	}
}

func TestSkillPublisherRejectsAProposalWithoutAnID(t *testing.T) {
	rpc := newFakeSkillRPC()
	rpc.response["skills.proposals.create"] = json.RawMessage(`{"record":{}}`)

	if _, err := NewSkillPublisher(rpc).Publish(context.Background(), "agent-1", SkillPayload{
		Name: "cpu-report", Description: "d", Main: "body",
	}); err == nil {
		t.Fatal("publish succeeded without a proposal id, want error")
	}
	for _, call := range rpc.calls {
		if call == "skills.proposals.apply" {
			t.Fatal("apply was called without a proposal id")
		}
	}
}

func TestSkillPublisherOmitsAgentIDWhenEmpty(t *testing.T) {
	rpc := newFakeSkillRPC()

	if _, err := NewSkillPublisher(rpc).Publish(context.Background(), "", SkillPayload{
		Name: "cpu-report", Description: "d", Main: "body",
	}); err != nil {
		t.Fatalf("publish: %v", err)
	}
	var created map[string]interface{}
	rpc.paramsFor(t, "skills.proposals.create", &created)
	if _, ok := created["agentId"]; ok {
		t.Fatalf("agentId sent even though it is empty: %v", created)
	}
}
