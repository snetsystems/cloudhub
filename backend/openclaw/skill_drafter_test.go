package openclaw

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type fakeSkillChat struct {
	sent     []SendMessageParams
	messages []Message
	sendErr  error
	histErr  error
}

func (f *fakeSkillChat) SendMessage(_ context.Context, params SendMessageParams) (SendMessageResult, error) {
	f.sent = append(f.sent, params)
	if f.sendErr != nil {
		return SendMessageResult{}, f.sendErr
	}
	return SendMessageResult{RunID: params.IdempotencyKey, Status: "started"}, nil
}

func (f *fakeSkillChat) History(_ context.Context, _ HistoryParams) (HistoryPage, error) {
	if f.histErr != nil {
		return HistoryPage{}, f.histErr
	}
	return HistoryPage{Messages: f.messages}, nil
}

func assistantMessage(text string) Message {
	return Message{Role: "assistant", Content: []ContentPart{{Type: "text", Text: text}}}
}

func TestSkillDrafterExtractsTheFencedBody(t *testing.T) {
	chat := &fakeSkillChat{messages: []Message{
		{Role: "user", Content: []ContentPart{{Type: "text", Text: "request"}}},
		assistantMessage("여기 있습니다:\n\n```markdown\n---\nname: cpu-report\n---\n\n# Body\n```\n확인해 주세요."),
	}}

	draft, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "CPU 보고 업무"})
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if !strings.HasPrefix(draft.Main, "---\nname: cpu-report") {
		t.Fatalf("main = %q", draft.Main)
	}
	if strings.Contains(draft.Main, "```") {
		t.Fatalf("fence markers left in body: %q", draft.Main)
	}
	if strings.Contains(draft.Main, "확인해 주세요") {
		t.Fatalf("prose after the fence leaked into the body: %q", draft.Main)
	}
	if draft.SessionKey != "sess-1" {
		t.Fatalf("session key = %q", draft.SessionKey)
	}
}

func TestSkillDrafterFallsBackToTheWholeReply(t *testing.T) {
	chat := &fakeSkillChat{messages: []Message{
		assistantMessage("---\nname: cpu-report\n---\n\n# Body"),
	}}

	draft, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"})
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if !strings.HasPrefix(draft.Main, "---\nname: cpu-report") {
		t.Fatalf("main = %q", draft.Main)
	}
}

func TestSkillDrafterUsesTheLastAssistantReply(t *testing.T) {
	chat := &fakeSkillChat{messages: []Message{
		assistantMessage("first attempt"),
		{Role: "user", Content: []ContentPart{{Type: "text", Text: "again"}}},
		assistantMessage("```\nsecond attempt\n```"),
	}}

	draft, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"})
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if draft.Main != "second attempt" {
		t.Fatalf("main = %q, want the last reply", draft.Main)
	}
}

func TestSkillDrafterSendsATemplateNotTheBareGoal(t *testing.T) {
	chat := &fakeSkillChat{messages: []Message{assistantMessage("body")}}

	if _, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "CPU 보고 업무"}); err != nil {
		t.Fatalf("draft: %v", err)
	}
	if len(chat.sent) != 1 {
		t.Fatalf("sent %d messages, want 1", len(chat.sent))
	}
	sent := chat.sent[0].Message
	if sent == "CPU 보고 업무" {
		t.Fatal("the goal was sent bare; it must be wrapped in the drafting template")
	}
	if !strings.Contains(sent, "CPU 보고 업무") {
		t.Fatalf("goal missing from the request: %q", sent)
	}
	if !strings.Contains(sent, "skill_workshop") {
		t.Fatalf("template does not forbid skill_workshop: %q", sent)
	}
	if chat.sent[0].AgentID != "agent-1" || chat.sent[0].SessionKey != "sess-1" {
		t.Fatalf("routing = %+v", chat.sent[0])
	}
}

// The drafter must not create a Gateway proposal: proposal creation belongs to
// SkillPublisher, driven by CloudHub after an Admin approves. A drafter that
// reached for skills.proposals.* would put content in front of an agent that
// nobody had reviewed.
func TestSkillDrafterHasNoProposalSurface(t *testing.T) {
	chat := &fakeSkillChat{messages: []Message{assistantMessage("body")}}
	drafter := NewSkillDrafter(chat)

	if _, ok := interface{}(drafter).(SkillRPC); ok {
		t.Fatal("the drafter exposes a raw RPC surface; it must only send chat messages")
	}
	if _, err := drafter.Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"}); err != nil {
		t.Fatalf("draft: %v", err)
	}
	for _, sent := range chat.sent {
		if strings.Contains(sent.Message, "skills.proposals") {
			t.Fatalf("the drafting request mentions the proposal API: %q", sent.Message)
		}
	}
}

func TestSkillDrafterReportsAnEmptyReply(t *testing.T) {
	chat := &fakeSkillChat{messages: []Message{}}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	if _, err := NewSkillDrafter(chat).Draft(ctx, DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"}); err == nil {
		t.Fatal("draft with no reply succeeded, want error")
	}
}

func TestSkillDrafterReportsSendFailure(t *testing.T) {
	chat := &fakeSkillChat{sendErr: errors.New("gateway down")}
	if _, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"}); err == nil {
		t.Fatal("draft succeeded, want error")
	}
}

func TestSkillDrafterReportsHistoryFailure(t *testing.T) {
	chat := &fakeSkillChat{histErr: errors.New("gateway down")}
	if _, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"}); err == nil {
		t.Fatal("draft succeeded, want error")
	}
}

// A SKILL.md body routinely shows a command in a code block of its own.
// Treating the first nested fence as the closing one cut the document off at
// exactly the point it became useful.
func TestSkillDrafterKeepsCodeBlocksInsideTheDocument(t *testing.T) {
	reply := "```markdown\n" +
		"---\nname: cpu-report\ndescription: one line\n---\n\n" +
		"# CPU Report\n\n## 순서\n\n1. 다음을 실행합니다:\n\n" +
		"```bash\nmpstat 1 1\n```\n\n" +
		"2. 결과를 정리합니다.\n" +
		"```"

	chat := &fakeSkillChat{messages: []Message{assistantMessage(reply)}}

	draft, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"})
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if !strings.Contains(draft.Main, "mpstat 1 1") {
		t.Fatalf("the nested code block was dropped: %q", draft.Main)
	}
	if !strings.Contains(draft.Main, "2. 결과를 정리합니다.") {
		t.Fatalf("the document was truncated at the nested fence: %q", draft.Main)
	}
	if strings.HasSuffix(strings.TrimSpace(draft.Main), "```") {
		t.Fatalf("the outer closing fence leaked into the body: %q", draft.Main)
	}
}

// An unterminated outer fence still has to yield the document, because the
// alternative is handing the author an empty editor.
func TestSkillDrafterAcceptsAnUnclosedFence(t *testing.T) {
	chat := &fakeSkillChat{messages: []Message{
		assistantMessage("```markdown\n---\nname: cpu-report\n---\n\n# Body"),
	}}

	draft, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"})
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if !strings.HasPrefix(draft.Main, "---\nname: cpu-report") {
		t.Fatalf("main = %q", draft.Main)
	}
	if !strings.Contains(draft.Main, "# Body") {
		t.Fatalf("body missing: %q", draft.Main)
	}
}

// Revising has to hand the agent the document being edited. Without it a
// request to "also check https" comes back as an unrelated skill under a new
// name, discarding what the author had.
func TestSkillDrafterSendsTheDocumentWhenRevising(t *testing.T) {
	chat := &fakeSkillChat{messages: []Message{assistantMessage("```\nbody\n```")}}

	current := "---\nname: check-nginx-status\ndescription: one line\n---\n\n# Check Nginx Status\n"
	if _, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{
		AgentID:    "agent-1",
		SessionKey: "sess-1",
		Goal:       "https 블럭도 같이 확인합니다",
		Current:    current,
		Name:       "check-nginx-status",
	}); err != nil {
		t.Fatalf("draft: %v", err)
	}

	sent := chat.sent[0].Message
	if !strings.Contains(sent, "# Check Nginx Status") {
		t.Fatalf("the document being revised was not sent: %q", sent)
	}
	if !strings.Contains(sent, "check-nginx-status") {
		t.Fatalf("the name to keep was not sent: %q", sent)
	}
	if !strings.Contains(sent, "https 블럭도 같이 확인합니다") {
		t.Fatalf("goal missing: %q", sent)
	}
}

// A draft with no document is a new skill, and must not be told to preserve a
// name it does not have yet.
func TestSkillDrafterFallsBackToTheNewSkillInstruction(t *testing.T) {
	cases := []DraftRequest{
		{AgentID: "a", SessionKey: "s", Goal: "goal"},
		{AgentID: "a", SessionKey: "s", Goal: "goal", Name: "some-skill"},
		{AgentID: "a", SessionKey: "s", Goal: "goal", Current: "   "},
	}

	for _, request := range cases {
		chat := &fakeSkillChat{messages: []Message{assistantMessage("body")}}
		if _, err := NewSkillDrafter(chat).Draft(context.Background(), request); err != nil {
			t.Fatalf("draft: %v", err)
		}
		if sent := chat.sent[0].Message; strings.Contains(sent, "현재 SKILL.md") {
			t.Fatalf("the revision instruction was used for %+v: %q", request, sent)
		}
	}
}

// A thinking model streams its reasoning inline in the same text part, and
// that reasoning routinely rehearses the document in a fenced block. Opening
// on the rehearsal saved it, the closing tag and the real answer as one
// document — an author was handed the same skill twice with "</think>" in the
// middle.
func TestSkillDrafterDropsReasoningThatRehearsesTheDocument(t *testing.T) {
	reply := "```markdown\n" +
		"---\nname: draft-attempt\ndescription: rehearsal\n---\n\n# Rehearsal\n" +
		"```\n" +
		"이제 최종본을 쓰자.\n" +
		"</think>\n\n" +
		"```markdown\n" +
		"---\nname: cpu-report\ndescription: one line\n---\n\n# CPU Report\n" +
		"```"

	chat := &fakeSkillChat{messages: []Message{assistantMessage(reply)}}

	draft, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"})
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if strings.Contains(draft.Main, "</think>") {
		t.Fatalf("the reasoning tag leaked into the document: %q", draft.Main)
	}
	if strings.Contains(draft.Main, "draft-attempt") {
		t.Fatalf("the rehearsal was saved alongside the answer: %q", draft.Main)
	}
	if !strings.HasPrefix(draft.Main, "---\nname: cpu-report") {
		t.Fatalf("main = %q", draft.Main)
	}
	if strings.Count(draft.Main, "# CPU Report") != 1 {
		t.Fatalf("the document was not returned exactly once: %q", draft.Main)
	}
}

// Stripping is guarded: a document that mentions the tag but has no fence
// after it must come back whole rather than empty.
func TestSkillDrafterKeepsAReplyWhoseTagHasNoFenceAfterIt(t *testing.T) {
	reply := "```markdown\n" +
		"---\nname: tag-doc\ndescription: one line\n---\n\n" +
		"# Tag Doc\n\n모델 출력에서 </think> 를 지웁니다.\n" +
		"```"

	chat := &fakeSkillChat{messages: []Message{assistantMessage(reply)}}

	draft, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"})
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if !strings.HasPrefix(draft.Main, "---\nname: tag-doc") {
		t.Fatalf("main = %q", draft.Main)
	}
	if !strings.Contains(draft.Main, "</think>") {
		t.Fatalf("the document's own mention of the tag was dropped: %q", draft.Main)
	}
}

// Replies with no reasoning at all must be untouched.
func TestSkillDrafterLeavesAPlainReplyAlone(t *testing.T) {
	chat := &fakeSkillChat{messages: []Message{
		assistantMessage("```markdown\n---\nname: cpu-report\n---\n\n# Body\n```"),
	}}

	draft, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"})
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if draft.Main != "---\nname: cpu-report\n---\n\n# Body" {
		t.Fatalf("main = %q", draft.Main)
	}
}

// The opposite shape: the model wrote the document, then closed a reasoning
// block it never opened, and said nothing after it. Taking the tail here would
// hand the author "NO_REPLY" instead of the skill they asked for.
func TestSkillDrafterKeepsADocumentThatPrecedesTheTag(t *testing.T) {
	reply := "---\nname: telegraf-missing-diagnosis\ndescription: one line\n---\n\n" +
		"# 진단\n\n## 순서\n\n1. 호스트를 확인한다.\n" +
		"</think>\n\nNO_REPLY"

	chat := &fakeSkillChat{messages: []Message{assistantMessage(reply)}}

	draft, err := NewSkillDrafter(chat).Draft(context.Background(), DraftRequest{AgentID: "agent-1", SessionKey: "sess-1", Goal: "goal"})
	if err != nil {
		t.Fatalf("draft: %v", err)
	}
	if strings.TrimSpace(draft.Main) == "NO_REPLY" {
		t.Fatal("the document was thrown away for the text after the tag")
	}
	if !strings.HasPrefix(draft.Main, "---\nname: telegraf-missing-diagnosis") {
		t.Fatalf("main = %q", draft.Main)
	}
	if !strings.Contains(draft.Main, "1. 호스트를 확인한다.") {
		t.Fatalf("the body was lost: %q", draft.Main)
	}
}
