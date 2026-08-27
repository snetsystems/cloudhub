package openclaw

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// SkillDraft is what an authoring agent produced. Main is the SKILL.md body.
type SkillDraft struct {
	Main       string
	SessionKey string
}

// DraftRequest is one request for a draft.
//
// Current and Name are set when revising an existing skill. Without them the
// agent has no way to tell a revision from a brand new skill, and answers a
// request to "also check https" by writing an unrelated skill under a new name
// — throwing away the document the author was editing.
type DraftRequest struct {
	AgentID    string
	SessionKey string
	Goal       string
	// Current is the SKILL.md being revised, as it stands in the editor.
	Current string
	// Name is the name the revision has to keep. A revision may not rename
	// its skill.
	Name string
}

// SkillChat is the chat surface the drafter needs. It is deliberately narrow:
// the drafter can send a message and read the transcript, and nothing else.
type SkillChat interface {
	SendMessage(ctx context.Context, params SendMessageParams) (SendMessageResult, error)
	History(ctx context.Context, params HistoryParams) (HistoryPage, error)
}

// draftTemplate wraps the user's goal.
//
// The instruction is narrow on purpose. A local model handed a bare goal
// reaches for unrelated tools and stalls, and a draft that called
// skill_workshop would create a Gateway proposal behind CloudHub's back —
// content in front of an agent that nobody reviewed.
//
// It is also specific about the shape of the document. Asked only for "a
// SKILL.md with name and description", a small model writes the whole skill as
// one YAML mapping and never closes the frontmatter, which CloudHub then has
// to refuse. Naming the two halves and showing a skeleton is what keeps the
// body in markdown.
const draftTemplate = `당신은 OpenClaw 스킬 작성기입니다.
아래 업무를 수행하는 SKILL.md 한 편을 작성하세요.

SKILL.md는 두 부분으로 이루어집니다.
1. YAML frontmatter — ` + "`---`" + ` 로 열고 ` + "`---`" + ` 로 닫습니다. 키는 name과 description 둘뿐입니다.
2. 본문 — 닫는 ` + "`---`" + ` 다음부터 끝까지, YAML이 아니라 **마크다운**입니다.

형식:

` + "```" + `
---
name: <소문자로 시작하고 소문자, 숫자, -, _ 만 쓴 이름>
description: <이 스킬을 언제 쓰는지 한 문장. 한 줄로.>
---

# <제목>

<언제 이 스킬을 쓰는지 한두 문장.>

## 순서

1. <첫 단계>
2. <다음 단계>

## 결과

<무엇을 어떤 형태로 보고할지.>
` + "```" + `

규칙:
- 응답은 코드 펜스(` + "```" + `) 하나만 담고, 그 안에 SKILL.md 전문을 넣으세요. 펜스 밖에는 아무것도 쓰지 마세요.
- 닫는 ` + "`---`" + ` 를 빠뜨리지 마세요.
- frontmatter에 name과 description 말고 다른 키를 넣지 마세요. parameters, schedule, tools 같은 키는 쓰지 않습니다.
- description은 한 줄로 쓰세요. ` + "`|`" + ` 나 ` + "`>`" + ` 같은 여러 줄 표기를 쓰지 마세요. 160바이트를 넘기지 마세요.
- 스크립트나 설정을 frontmatter에 넣지 말고, 필요하면 본문 안에 코드 블록으로 적으세요.
- 전체를 40000바이트 안에서 쓰세요.
- 어떤 툴도 호출하지 마세요. 특히 skill_workshop 을 호출하지 마세요.
- 제안을 만들지 마세요. 저장과 적용은 CloudHub가 합니다.

업무:
%s`

// reviseTemplate wraps a goal that applies to a skill already in hand. It
// leads with the document so the model treats the request as an edit, and
// names the one field it must not change.
const reviseTemplate = `당신은 OpenClaw 스킬 작성기입니다.
아래 SKILL.md를 요구사항에 맞게 고쳐서, 고친 전문을 내놓으세요.

현재 SKILL.md:

` + "```" + `
%s
` + "```" + `

규칙:
- 응답은 코드 펜스(` + "```" + `) 하나만 담고, 그 안에 고친 SKILL.md 전문을 넣으세요. 펜스 밖에는 아무것도 쓰지 마세요.
- 일부만 내놓지 말고 처음부터 끝까지 전문을 내놓으세요.
- name은 반드시 ` + "`%s`" + ` 그대로 두세요. 이름은 바꿀 수 없습니다.
- 요구사항과 상관없는 부분은 그대로 두세요.
- frontmatter는 ` + "`---`" + ` 로 열고 ` + "`---`" + ` 로 닫으며, 키는 name과 description 둘뿐입니다.
- description은 한 줄로 쓰고 160바이트를 넘기지 마세요.
- 닫는 ` + "`---`" + ` 다음은 YAML이 아니라 마크다운입니다.
- 어떤 툴도 호출하지 마세요. 특히 skill_workshop 을 호출하지 마세요.
- 제안을 만들지 마세요. 저장과 적용은 CloudHub가 합니다.

요구사항:
%s`

// draftPollInterval is how often the transcript is re-read while the agent is
// still producing its reply.
const draftPollInterval = 2 * time.Second

// SkillDrafter asks an organization's authoring agent for a SKILL.md draft.
//
// It never creates a Gateway proposal. Drafting has no side effect the user
// has to undo, so they can regenerate until satisfied; publishing belongs to
// SkillPublisher, which runs only after an Admin approves.
type SkillDrafter struct {
	chat SkillChat
}

// NewSkillDrafter returns a drafter that talks to one Gateway.
func NewSkillDrafter(chat SkillChat) *SkillDrafter {
	return &SkillDrafter{chat: chat}
}

// Draft sends the goal to the authoring agent and returns the SKILL.md body it
// replied with. The caller's context deadline bounds the wait.
func (d *SkillDrafter) Draft(ctx context.Context, request DraftRequest) (SkillDraft, error) {
	if _, err := d.chat.SendMessage(ctx, SendMessageParams{
		SessionKey:     request.SessionKey,
		AgentID:        request.AgentID,
		Message:        draftMessage(request),
		IdempotencyKey: request.SessionKey,
	}); err != nil {
		return SkillDraft{}, fmt.Errorf("openclaw: ask the authoring agent: %w", err)
	}

	for {
		page, err := d.chat.History(ctx, HistoryParams{SessionKey: request.SessionKey})
		if err != nil {
			return SkillDraft{}, fmt.Errorf("openclaw: read the authoring transcript: %w", err)
		}
		if reply := lastAssistantText(page.Messages); reply != "" {
			return SkillDraft{Main: extractFencedBlock(reply), SessionKey: request.SessionKey}, nil
		}
		select {
		case <-ctx.Done():
			return SkillDraft{}, fmt.Errorf("openclaw: the authoring agent produced no draft: %w", ctx.Err())
		case <-time.After(draftPollInterval):
		}
	}
}

// draftMessage picks the instruction that matches what the author is doing:
// revising a document they already have, or starting one.
func draftMessage(request DraftRequest) string {
	if strings.TrimSpace(request.Current) != "" && strings.TrimSpace(request.Name) != "" {
		return fmt.Sprintf(reviseTemplate, request.Current, request.Name, request.Goal)
	}
	return fmt.Sprintf(draftTemplate, request.Goal)
}

// lastAssistantText returns the newest assistant reply. Reading backwards
// matters when the user regenerates: the transcript keeps every attempt, and
// the latest one is the answer.
func lastAssistantText(messages []Message) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role != "assistant" {
			continue
		}
		var b strings.Builder
		for _, part := range messages[i].Content {
			b.WriteString(part.Text)
		}
		if text := strings.TrimSpace(b.String()); text != "" {
			return text
		}
	}
	return ""
}

// extractFencedBlock returns the contents of the fenced code block the reply
// wraps its document in, or the whole reply when there is none. Models differ
// in whether they fence the document and whether they wrap it in prose, so an
// unfenced reply is handed back as-is for the user to edit rather than treated
// as a failure.
//
// The closing fence is the last one in the reply, not the first one after the
// opening. A SKILL.md body routinely contains code blocks of its own, and
// treating the first nested fence as the close truncated the document at
// exactly the point it started showing a command.
func extractFencedBlock(reply string) string {
	block := fencedBlock(reply)
	if !containsReasoningTag(block) {
		return block
	}

	// The extraction swept a reasoning block up with the document. A model
	// that rehearses puts its answer after the closing tag, so that side is
	// tried — but only when it is a document. Two other shapes reach here and
	// must keep the block as extracted: an answer that sits *before* a tag the
	// model never opened, and a document that merely mentions the tag. Taking
	// the tail on either of those would hand the author the model's "NO_REPLY"
	// instead of their skill.
	if _, after, ok := splitOnReasoning(reply); ok {
		if candidate := fencedBlock(after); startsWithFrontmatter(candidate) {
			return candidate
		}
	}
	return block
}

func startsWithFrontmatter(document string) bool {
	return strings.HasPrefix(strings.TrimSpace(document), "---")
}

func containsReasoningTag(text string) bool {
	for _, tag := range reasoningCloseTags {
		if strings.Contains(text, tag) {
			return true
		}
	}
	return false
}

func fencedBlock(reply string) string {
	lines := strings.Split(reply, "\n")

	open := -1
	for i, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			open = i
			break
		}
	}
	if open < 0 {
		return reply
	}

	close := -1
	for i := len(lines) - 1; i > open; i-- {
		if isFenceLine(lines[i]) {
			close = i
			break
		}
	}
	if close < 0 {
		close = len(lines)
	}

	return strings.TrimSpace(strings.Join(lines[open+1:close], "\n"))
}

// reasoningCloseTags end the block a thinking model streams before its answer.
var reasoningCloseTags = []string{"</think>", "</thinking>", "</reasoning>"}

// dropReasoning removes the reasoning a thinking model streams ahead of its
// answer. The Gateway hands it over inline in the same text part rather than
// as a part of its own, and the reasoning routinely rehearses the document in
// a fenced block. extractFencedBlock would then open on the rehearsal and
// close on the real answer, saving both — plus the closing tag between them —
// as one SKILL.md.
//
// splitOnReasoning divides a reply at its last closing reasoning tag. ok is
// false when the reply carries no tag at all.
func splitOnReasoning(reply string) (before string, after string, ok bool) {
	cut, tagLen := -1, 0
	for _, tag := range reasoningCloseTags {
		if i := strings.LastIndex(reply, tag); i > cut {
			cut, tagLen = i, len(tag)
		}
	}
	if cut < 0 {
		return "", "", false
	}
	return reply[:cut], reply[cut+tagLen:], true
}

// isFenceLine reports whether a line is nothing but a code fence, which is
// what a closing fence looks like. An opening fence usually carries an info
// string such as "markdown", so this does not match one.
func isFenceLine(line string) bool {
	trimmed := strings.TrimSpace(line)
	if len(trimmed) < 3 {
		return false
	}
	return strings.Trim(trimmed, "`") == ""
}
