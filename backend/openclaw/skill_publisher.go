package openclaw

import (
	"context"
	"encoding/json"
	"fmt"
)

// SkillFile is one file of a published skill. Path is relative to the skill
// directory and, for anything but SKILL.md, must sit under one of the
// Gateway's support folders.
type SkillFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// SkillPayload is one revision's complete content in the shape the Gateway
// wants: the SKILL.md body separate from the files that sit beside it.
type SkillPayload struct {
	Name        string
	Description string
	Main        string
	Support     []SkillFile
}

// PublishResult reports what the Gateway recorded. Scan is the Gateway's
// security scan verbatim; CloudHub stores it without modelling its shape so a
// new finding type does not need a code change here.
type PublishResult struct {
	ProposalID string
	Scan       json.RawMessage
}

// SkillRPC is the Gateway call surface the publisher needs.
type SkillRPC interface {
	Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error)
}

// SkillPublisher reflects an approved revision onto a Gateway agent workspace.
//
// It drives the skills.proposals.* family, which the Gateway's protocol
// reference does not list. Keeping every call to that family inside this one
// type is deliberate: if the Gateway changes it, only this file moves.
type SkillPublisher struct {
	rpc SkillRPC
}

// NewSkillPublisher returns a publisher that talks to one Gateway.
func NewSkillPublisher(rpc SkillRPC) *SkillPublisher {
	return &SkillPublisher{rpc: rpc}
}

type proposalRecord struct {
	Record struct {
		ID   string          `json:"id"`
		Scan json.RawMessage `json:"scan"`
	} `json:"record"`
}

// Publish writes one revision into an agent's workspace: it proposes the
// content, then applies the proposal. A skill the agent already has is
// updated; anything else is created.
//
// Apply runs only after the proposal succeeds, so a Gateway that rejects the
// content leaves the workspace untouched and the caller free to retry.
func (p *SkillPublisher) Publish(ctx context.Context, agentID string, payload SkillPayload) (PublishResult, error) {
	exists, err := p.skillExists(ctx, agentID, payload.Name)
	if err != nil {
		return PublishResult{}, err
	}

	// Send an empty array rather than null: the Gateway validates the field's
	// shape, and a nil slice marshals to null.
	support := make([]SkillFile, 0, len(payload.Support))
	support = append(support, payload.Support...)

	method := "skills.proposals.create"
	params := map[string]interface{}{
		"name":         payload.Name,
		"description":  payload.Description,
		"content":      payload.Main,
		"supportFiles": support,
	}
	if exists {
		method = "skills.proposals.update"
		params = map[string]interface{}{
			"skillName": payload.Name,
			// The description travels beside the body on an update too.
			// Leaving it out kept whatever the skill was created with, so a
			// revision that rewrote the description published a workspace file
			// whose frontmatter still described the first version — and the
			// description is what an agent reads to decide whether a skill
			// applies at all.
			"description":  payload.Description,
			"content":      payload.Main,
			"supportFiles": support,
		}
	}
	if agentID != "" {
		params["agentId"] = agentID
	}

	raw, err := p.rpc.Call(ctx, method, params)
	if err != nil {
		return PublishResult{}, fmt.Errorf("openclaw: propose skill %q: %w", payload.Name, err)
	}
	var record proposalRecord
	if err := json.Unmarshal(raw, &record); err != nil {
		return PublishResult{}, fmt.Errorf("%w: decode %s response: %v", ErrProtocol, method, err)
	}
	if record.Record.ID == "" {
		return PublishResult{}, fmt.Errorf("%w: %s returned no proposal id", ErrProtocol, method)
	}

	applyParams := map[string]interface{}{"proposalId": record.Record.ID}
	if agentID != "" {
		applyParams["agentId"] = agentID
	}
	if _, err := p.rpc.Call(ctx, "skills.proposals.apply", applyParams); err != nil {
		return PublishResult{}, fmt.Errorf("openclaw: apply proposal %q: %w", record.Record.ID, err)
	}

	return PublishResult{ProposalID: record.Record.ID, Scan: record.Record.Scan}, nil
}

// skillExists decides between create and update. The Gateway rejects a create
// for a skill that is already present, so this read is what keeps a second
// revision from failing.
func (p *SkillPublisher) skillExists(ctx context.Context, agentID, name string) (bool, error) {
	entries, err := p.Inventory(ctx, agentID)
	if err != nil {
		return false, err
	}
	for _, entry := range entries {
		if entry.Name == name {
			return true, nil
		}
	}
	return false, nil
}

// WorkspaceSource marks the Gateway inventory entries that came from an agent
// workspace, as opposed to the skills OpenClaw ships with. A CloudHub-authored
// skill is always one of these.
const WorkspaceSource = "openclaw-workspace"

// maxInventoryEntryBytes caps one preserved inventory entry. The Gateway
// decides what an entry holds, so an unexpected field cannot be allowed to
// make the response unbounded.
const maxInventoryEntryBytes = 8 * 1024

// SkillInventoryEntry is one skill as the Gateway reports it.
//
// Only the two fields CloudHub reasons about are decoded. Everything else
// travels in Raw exactly as the Gateway sent it: the entry's shape is the
// Gateway's to define and it changes between versions, so modelling it here
// would mean a code change every time it grows a field.
type SkillInventoryEntry struct {
	Name   string
	Source string
	// Raw is the entry verbatim, or a name-only stub when the Gateway sent
	// more than maxInventoryEntryBytes.
	Raw json.RawMessage
	// Truncated reports that Raw is that stub rather than the whole entry.
	Truncated bool
}

// Inventory reports what the Gateway currently holds for an agent.
//
// This is the Gateway's own view, not CloudHub's record of what it published.
// The two can disagree — a workspace edited by hand, an apply that never
// landed — and telling them apart is the point of reading it.
func (p *SkillPublisher) Inventory(ctx context.Context, agentID string) ([]SkillInventoryEntry, error) {
	params := map[string]interface{}{}
	if agentID != "" {
		params["agentId"] = agentID
	}
	raw, err := p.rpc.Call(ctx, "skills.status", params)
	if err != nil {
		return nil, fmt.Errorf("openclaw: read skill inventory: %w", err)
	}

	var status struct {
		Skills []json.RawMessage `json:"skills"`
	}
	if err := json.Unmarshal(raw, &status); err != nil {
		return nil, fmt.Errorf("%w: decode skills.status response: %v", ErrProtocol, err)
	}

	entries := make([]SkillInventoryEntry, 0, len(status.Skills))
	for _, item := range status.Skills {
		var shape struct {
			Name   string `json:"name"`
			Source string `json:"source"`
		}
		if err := json.Unmarshal(item, &shape); err != nil {
			return nil, fmt.Errorf("%w: decode skills.status entry: %v", ErrProtocol, err)
		}
		entry := SkillInventoryEntry{Name: shape.Name, Source: shape.Source, Raw: item}
		if len(item) > maxInventoryEntryBytes {
			entry.Raw = json.RawMessage(fmt.Sprintf(`{"name":%s,"source":%s}`,
				mustJSON(shape.Name), mustJSON(shape.Source)))
			entry.Truncated = true
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// mustJSON quotes a string for embedding in a hand-built JSON object. The
// input is a decoded string, so encoding it cannot fail.
func mustJSON(value string) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return `""`
	}
	return string(encoded)
}
