package server

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/bouk/httprouter"
	cloudhub "github.com/snetsystems/cloudhub/backend"
	idgen "github.com/snetsystems/cloudhub/backend/id"
	"github.com/snetsystems/cloudhub/backend/openclaw"
)

const (
	maxOpenClawSkillNameLength   = 64
	maxOpenClawSkillBodyBytes    = 40000
	maxOpenClawSkillDescBytes    = 160
	maxOpenClawSupportFiles      = 50
	maxOpenClawSupportTotalBytes = 1 << 20
	openClawMainPath             = "SKILL.md"
)

var openClawSkillNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_-]*$`)

// openClawReservedNames are the command names OpenClaw owns. A skill taking one
// of them would be shadowed by the built-in command, so it is refused here
// with a clear message rather than accepted and quietly unreachable.
var openClawReservedNames = map[string]bool{
	"help": true, "commands": true, "status": true, "diagnostics": true,
	"codex": true, "whoami": true, "context": true, "btw": true, "stop": true,
	"restart": true, "reset": true, "new": true, "compact": true, "config": true,
	"debug": true, "allowlist": true, "activation": true, "skill": true,
	"learn": true, "subagents": true, "kill": true, "steer": true, "tell": true,
	"model": true, "models": true, "queue": true, "send": true, "bash": true,
	"exec": true, "think": true, "verbose": true, "reasoning": true,
	"elevated": true, "usage": true,
}

// openClawSupportFolders are the only directories the Gateway accepts support
// files in.
var openClawSupportFolders = []string{"assets/", "examples/", "references/", "scripts/", "templates/"}

// validateOpenClawSkillName enforces the Gateway's slug rules and keeps a
// skill from taking a built-in command's name.
func validateOpenClawSkillName(name string) error {
	if name == "" {
		return fmt.Errorf("skill name is required")
	}
	if len(name) > maxOpenClawSkillNameLength {
		return fmt.Errorf("skill name exceeds %d characters", maxOpenClawSkillNameLength)
	}
	if !openClawSkillNamePattern.MatchString(name) {
		return fmt.Errorf("skill name must start with a lowercase letter and contain only lowercase letters, digits, hyphens, and underscores")
	}
	if openClawReservedNames[name] {
		return fmt.Errorf("skill name %q is reserved by OpenClaw", name)
	}
	return nil
}

// openClawFrontmatter pulls name and description out of a SKILL.md body. It
// reads only those two keys; the rest of the document is the Gateway's to
// interpret, and parsing it here would be a second, divergent reader.
func openClawFrontmatter(main string) (name string, description string, err error) {
	if !strings.HasPrefix(main, "---") {
		return "", "", fmt.Errorf("SKILL.md must start with YAML frontmatter")
	}
	rest := main[3:]
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return "", "", fmt.Errorf("SKILL.md frontmatter is not terminated")
	}

	lines := strings.Split(rest[:end], "\n")
	for i := 0; i < len(lines); i++ {
		line := lines[i]

		// Only top-level keys count. A key indented under something else
		// belongs to that structure, and reading one as the skill's own field
		// is how a parameter's description used to become the skill's.
		if line == "" || line[0] == ' ' || line[0] == '\t' || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		if key != "name" && key != "description" {
			continue
		}

		value = strings.TrimSpace(value)
		if folded, ok := blockScalarStyle(value); ok {
			// A block scalar holds its value in the indented lines that
			// follow, so those lines are consumed here rather than scanned as
			// keys of their own.
			value, i = readBlockScalar(lines, i, folded)
		} else {
			value = strings.Trim(value, `"'`)
		}

		switch key {
		case "name":
			name = value
		case "description":
			description = value
		}
	}

	if name == "" {
		return "", "", fmt.Errorf("SKILL.md frontmatter is missing name")
	}
	if description == "" {
		return "", "", fmt.Errorf("SKILL.md frontmatter is missing description")
	}
	if len(description) > maxOpenClawSkillDescBytes {
		return "", "", fmt.Errorf("description exceeds %d bytes", maxOpenClawSkillDescBytes)
	}
	return name, description, nil
}

// blockScalarStyle reports whether a value introduces a YAML block scalar, and
// whether that block is folded (">", lines joined with spaces) rather than
// literal ("|", lines joined with newlines). Chomping and indentation
// indicators such as "|-" or ">2" are accepted and ignored.
func blockScalarStyle(value string) (folded bool, ok bool) {
	if value == "" || (value[0] != '|' && value[0] != '>') {
		return false, false
	}
	for _, r := range value[1:] {
		if r != '-' && r != '+' && (r < '0' || r > '9') {
			return false, false
		}
	}
	return value[0] == '>', true
}

// readBlockScalar collects the indented lines making up a block scalar that
// starts at lines[start], and returns the value along with the index of the
// last line it consumed.
func readBlockScalar(lines []string, start int, folded bool) (string, int) {
	var block []string
	last := start
	for i := start + 1; i < len(lines); i++ {
		line := lines[i]
		if strings.TrimSpace(line) == "" {
			// A blank line may sit inside the block, so it is only kept once
			// a following indented line proves the block continued.
			block = append(block, "")
			last = i
			continue
		}
		if line[0] != ' ' && line[0] != '\t' {
			break
		}
		block = append(block, strings.TrimSpace(line))
		last = i
	}

	for len(block) > 0 && block[len(block)-1] == "" {
		block = block[:len(block)-1]
	}
	separator := "\n"
	if folded {
		separator = " "
	}
	return strings.TrimSpace(strings.Join(block, separator)), last
}

// validateOpenClawSkillFiles mirrors the Gateway's own rejection rules so a bad
// submission fails here, where the author can read why, instead of deep inside
// a proposal call.
func validateOpenClawSkillFiles(main string, support []cloudhub.OpenClawSkillFile) error {
	if len(main) > maxOpenClawSkillBodyBytes {
		return fmt.Errorf("SKILL.md exceeds %d bytes", maxOpenClawSkillBodyBytes)
	}
	if !utf8.ValidString(main) {
		return fmt.Errorf("SKILL.md is not valid UTF-8")
	}
	name, _, err := openClawFrontmatter(main)
	if err != nil {
		return err
	}
	if err := validateOpenClawSkillName(name); err != nil {
		return err
	}

	if len(support) > maxOpenClawSupportFiles {
		return fmt.Errorf("at most %d support files are allowed", maxOpenClawSupportFiles)
	}
	total := len(main)
	seen := map[string]bool{}
	for _, file := range support {
		if err := validateOpenClawSupportPath(file.Path); err != nil {
			return err
		}
		if seen[file.Path] {
			return fmt.Errorf("duplicate support file path %q", file.Path)
		}
		seen[file.Path] = true
		if !utf8.ValidString(file.Content) {
			return fmt.Errorf("support file %q is not valid UTF-8", file.Path)
		}
		if strings.ContainsRune(file.Content, 0) {
			return fmt.Errorf("support file %q contains a null byte", file.Path)
		}
		total += len(file.Content)
	}
	if total > maxOpenClawSupportTotalBytes {
		return fmt.Errorf("the skill exceeds %d bytes in total", maxOpenClawSupportTotalBytes)
	}
	return nil
}

func validateOpenClawSupportPath(path string) error {
	if path == "" {
		return fmt.Errorf("support file path is required")
	}
	if path == openClawMainPath {
		return fmt.Errorf("SKILL.md is supplied separately, not as a support file")
	}
	if strings.HasPrefix(path, "/") {
		return fmt.Errorf("support file path %q must be relative", path)
	}
	allowed := false
	for _, folder := range openClawSupportFolders {
		if strings.HasPrefix(path, folder) {
			allowed = true
			break
		}
	}
	if !allowed {
		return fmt.Errorf("support file path %q must start with one of %s",
			path, strings.Join(openClawSupportFolders, ", "))
	}
	for _, segment := range strings.Split(path, "/") {
		if segment == "" || strings.HasPrefix(segment, ".") {
			return fmt.Errorf("support file path %q has an invalid segment %q", path, segment)
		}
	}
	return nil
}

// openClawFileHash is the SHA-256 of one file's content.
func openClawFileHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

// openClawTreeHash fingerprints a complete file set so an unchanged
// resubmission can be rejected without comparing every file. It sorts by path
// first, so the order a client happens to send does not change the result, and
// it feeds the path in as well as the content so a rename registers as a change.
func openClawTreeHash(files []cloudhub.OpenClawSkillFile) string {
	sorted := make([]cloudhub.OpenClawSkillFile, len(files))
	copy(sorted, files)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Path < sorted[j].Path })

	h := sha256.New()
	for _, file := range sorted {
		h.Write([]byte(file.Path))
		h.Write([]byte{0})
		h.Write([]byte(file.ContentHash))
		h.Write([]byte{'\n'})
	}
	return hex.EncodeToString(h.Sum(nil))
}

type openClawSkillFileDTO struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// openClawSkillFiles turns a request body into the stored file set: SKILL.md
// first, then the support files, each with its own hash and size.
func openClawSkillFiles(main string, support []openClawSkillFileDTO) []cloudhub.OpenClawSkillFile {
	files := make([]cloudhub.OpenClawSkillFile, 0, len(support)+1)
	files = append(files, cloudhub.OpenClawSkillFile{
		Path:        openClawMainPath,
		Content:     main,
		ContentHash: openClawFileHash(main),
		SizeBytes:   len(main),
	})
	for _, file := range support {
		files = append(files, cloudhub.OpenClawSkillFile{
			Path:        file.Path,
			Content:     file.Content,
			ContentHash: openClawFileHash(file.Content),
			SizeBytes:   len(file.Content),
		})
	}
	return files
}

func openClawSupportFromDTO(support []openClawSkillFileDTO) []cloudhub.OpenClawSkillFile {
	files := make([]cloudhub.OpenClawSkillFile, 0, len(support))
	for _, file := range support {
		files = append(files, cloudhub.OpenClawSkillFile{Path: file.Path, Content: file.Content})
	}
	return files
}

type openClawDraftRequest struct {
	Goal string `json:"goal"`
	// Main and Name are sent when revising: the SKILL.md as it stands in the
	// editor, and the name the revision has to keep. Without them the agent
	// cannot tell a revision from a new skill and answers with an unrelated
	// document under a name of its own choosing.
	Main string `json:"main,omitempty"`
	Name string `json:"name,omitempty"`
}

type openClawDraftResponse struct {
	Main         string                 `json:"main"`
	SupportFiles []openClawSkillFileDTO `json:"supportFiles"`
	SessionID    string                 `json:"sessionId"`
}

type openClawSkillRequest struct {
	Main         string                 `json:"main"`
	SupportFiles []openClawSkillFileDTO `json:"supportFiles"`
	Goal         string                 `json:"goal"`
}

type openClawSkillDTO struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Status         string `json:"status"`
	ActiveRevision int    `json:"activeRevision"`
	CreatedBy      string `json:"createdBy"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

type openClawSkillsResponse struct {
	Skills []openClawSkillDTO `json:"skills"`
}

type openClawSkillDetailResponse struct {
	Skill     openClawSkillDTO                 `json:"skill"`
	Revisions []cloudhub.OpenClawSkillRevision `json:"revisions"`
}

func openClawSkillToDTO(skill cloudhub.OpenClawSkill) openClawSkillDTO {
	return openClawSkillDTO{
		ID:             skill.ID,
		Name:           skill.Name,
		Status:         skill.Status,
		ActiveRevision: skill.ActiveRevision,
		CreatedBy:      skill.CreatedBy,
		CreatedAt:      skill.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      skill.UpdatedAt.Format(time.RFC3339),
	}
}

// openClawSkillStoreError maps store errors onto status codes. A skill in
// another organization reports as absent so an ID cannot be probed.
func (s *Service) openClawSkillStoreError(w http.ResponseWriter, err error) {
	if errors.Is(err, cloudhub.ErrOpenClawSkillNotFound) {
		Error(w, http.StatusNotFound, "skill not found", s.Logger)
		return
	}
	Error(w, http.StatusBadGateway, "unable to reach the skill store", s.Logger)
}

// openClawAgentMappingError reports a missing agent mapping as a conflict: the
// request is well formed but the organization has not been set up yet.
// openclawAgentName is the Gateway agent name for one organization and
// purpose. It is a thin alias so tests and handlers agree on the scheme.
func openclawAgentName(organizationID, purpose string) string {
	return openclaw.AgentName(organizationID, purpose)
}

// openClawAgentFor resolves the agent an organization uses for a purpose,
// creating it on first use.
//
// Provisioning is lazy on purpose. Creating agents when an organization is
// created would make organization creation fail whenever the Gateway is
// unreachable, and would scaffold workspaces for organizations that never
// touch OpenClaw.
//
// The workspace the new agent gets is what isolates one organization's skills
// from another's, so each organization and purpose gets its own.
func (s *Service) openClawAgentFor(ctx context.Context, orgID, purpose string) (string, error) {
	agents := s.Store.OpenClawOrgAgents(ctx)
	agentID, err := agents.Get(ctx, orgID, purpose)
	if err == nil {
		return agentID, nil
	}
	if !errors.Is(err, cloudhub.ErrOpenClawAgentNotMapped) {
		return "", err
	}
	if s.OpenClawAgentProvisioner == nil {
		// No workspace root configured. Fall back to the manual mapping an
		// administrator supplies through PUT /org-agents.
		return "", err
	}

	created, err := s.OpenClawAgentProvisioner.Ensure(ctx, openclawAgentName(orgID, purpose))
	if err != nil {
		// Nothing is bound, so the next request retries rather than
		// addressing an agent that was never created.
		return "", err
	}
	// Ensure keeps whatever is already bound, so a request that lost a race
	// gets the agent that won it instead of its own.
	return agents.Ensure(ctx, orgID, purpose, created)
}

func (s *Service) openClawAgentMappingError(w http.ResponseWriter, err error, purpose string) {
	if errors.Is(err, cloudhub.ErrOpenClawAgentNotMapped) {
		Error(w, http.StatusConflict,
			fmt.Sprintf("this organization has no %s agent; an administrator must map one first", purpose), s.Logger)
		return
	}
	Error(w, http.StatusBadGateway, "unable to read the agent mapping", s.Logger)
}

// OpenClawSkillDraft asks the organization's authoring agent for a SKILL.md
// draft. It stores nothing and creates no Gateway proposal, so a user can
// regenerate until satisfied without leaving anything to clean up.
func (s *Service) OpenClawSkillDraft(w http.ResponseWriter, r *http.Request) {
	ctx, user, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	if s.OpenClawSkillDrafter == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
		return
	}

	var request openClawDraftRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}
	goal := strings.TrimSpace(request.Goal)
	if goal == "" {
		Error(w, http.StatusUnprocessableEntity, "goal is required", s.Logger)
		return
	}
	// The document only travels as prompt text, but an oversized one would
	// still be sent to the agent, so it is bounded by the same limit a saved
	// SKILL.md has.
	if len(request.Main) > maxOpenClawSkillBodyBytes {
		Error(w, http.StatusUnprocessableEntity,
			fmt.Sprintf("SKILL.md exceeds %d bytes", maxOpenClawSkillBodyBytes), s.Logger)
		return
	}

	agentID, err := s.openClawAgentFor(ctx, orgID, cloudhub.OpenClawAgentAuthoring)
	if err != nil {
		s.openClawAgentMappingError(w, err, cloudhub.OpenClawAgentAuthoring)
		return
	}

	sessionID, err := (&idgen.UUID{}).Generate()
	if err != nil {
		internalServerError(w, err, s.Logger)
		return
	}
	sessionKey := fmt.Sprintf("agent:%s:cloudhub:%s:%d:%s", agentID, orgID, user.ID, sessionID)

	draft, err := s.OpenClawSkillDrafter.Draft(ctx, openclaw.DraftRequest{
		AgentID:    agentID,
		SessionKey: sessionKey,
		Goal:       goal,
		Current:    request.Main,
		Name:       strings.TrimSpace(request.Name),
	})
	if err != nil {
		s.openClawGatewayError(w, err)
		return
	}

	encodeJSON(w, http.StatusOK, openClawDraftResponse{
		Main:         draft.Main,
		SupportFiles: []openClawSkillFileDTO{},
		SessionID:    sessionID,
	}, s.Logger)
}

// OpenClawSkillsList returns the organization's skills.
func (s *Service) OpenClawSkillsList(w http.ResponseWriter, r *http.Request) {
	ctx, _, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	skills, err := s.Store.OpenClawSkills(ctx).List(ctx, orgID)
	if err != nil {
		Error(w, http.StatusBadGateway, "unable to read skills", s.Logger)
		return
	}
	response := openClawSkillsResponse{Skills: make([]openClawSkillDTO, 0, len(skills))}
	for _, skill := range skills {
		response.Skills = append(response.Skills, openClawSkillToDTO(skill))
	}
	encodeJSON(w, http.StatusOK, response, s.Logger)
}

type openClawSkillInventoryResponse struct {
	AgentID string            `json:"agentId"`
	Skills  []json.RawMessage `json:"skills"`
}

// OpenClawSkillInventory reports what the organization's execution agent
// actually holds, read live from the Gateway.
//
// This is deliberately separate from the skill list. The list is CloudHub's
// own record and must render even when the Gateway is unreachable; this is the
// Gateway's answer, which can disagree with that record — a workspace edited
// by hand, a skill disabled in Gateway config, an apply that never landed.
//
// Entries are passed through as the Gateway sent them. Their fields are the
// Gateway's to define, so modelling them here would mean a code change every
// time one is added.
func (s *Service) OpenClawSkillInventory(w http.ResponseWriter, r *http.Request) {
	ctx, _, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	if s.OpenClawSkillPublisher == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
		return
	}

	// The mapping is read, never created. Provisioning an agent is a write,
	// and a status view must not have that side effect: an organization that
	// has published nothing simply has nothing to report.
	agentID, err := s.Store.OpenClawOrgAgents(ctx).Get(ctx, orgID, cloudhub.OpenClawAgentExecution)
	if err != nil {
		if errors.Is(err, cloudhub.ErrOpenClawAgentNotMapped) {
			encodeJSON(w, http.StatusOK, openClawSkillInventoryResponse{
				Skills: []json.RawMessage{},
			}, s.Logger)
			return
		}
		Error(w, http.StatusBadGateway, "unable to read the agent mapping", s.Logger)
		return
	}

	entries, err := s.OpenClawSkillPublisher.Inventory(ctx, agentID)
	if err != nil {
		s.openClawGatewayError(w, err)
		return
	}

	// Only workspace skills belong to an organization. The rest of the
	// inventory is what OpenClaw ships with, which CloudHub neither published
	// nor manages.
	response := openClawSkillInventoryResponse{AgentID: agentID, Skills: []json.RawMessage{}}
	for _, entry := range entries {
		if entry.Source != openclaw.WorkspaceSource {
			continue
		}
		response.Skills = append(response.Skills, entry.Raw)
	}
	encodeJSON(w, http.StatusOK, response, s.Logger)
}

// OpenClawSkillGet returns one skill with its revision history.
func (s *Service) OpenClawSkillGet(w http.ResponseWriter, r *http.Request) {
	ctx, _, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	id := httprouter.GetParamFromContext(ctx, "id")

	store := s.Store.OpenClawSkills(ctx)
	skill, err := store.Get(ctx, orgID, id)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	revisions, err := store.Revisions(ctx, orgID, id)
	if err != nil {
		Error(w, http.StatusBadGateway, "unable to read revisions", s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, openClawSkillDetailResponse{
		Skill:     openClawSkillToDTO(*skill),
		Revisions: revisions,
	}, s.Logger)
}

// OpenClawSkillCreate stores a draft as revision 1. Nothing reaches the
// Gateway until an Admin approves it.
func (s *Service) OpenClawSkillCreate(w http.ResponseWriter, r *http.Request) {
	ctx, user, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}

	var request openClawSkillRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}
	if err := validateOpenClawSkillFiles(request.Main, openClawSupportFromDTO(request.SupportFiles)); err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}
	name, _, err := openClawFrontmatter(request.Main)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	skillID, err := (&idgen.UUID{}).Generate()
	if err != nil {
		internalServerError(w, err, s.Logger)
		return
	}
	revisionID, err := (&idgen.UUID{}).Generate()
	if err != nil {
		internalServerError(w, err, s.Logger)
		return
	}

	now := time.Now().UTC()
	files := openClawSkillFiles(request.Main, request.SupportFiles)
	skill := &cloudhub.OpenClawSkill{
		ID:             skillID,
		OrganizationID: orgID,
		Name:           name,
		Status:         cloudhub.OpenClawSkillDraft,
		CreatedBy:      strconv.FormatUint(user.ID, 10),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	revision := &cloudhub.OpenClawSkillRevision{
		ID:           revisionID,
		TreeHash:     openClawTreeHash(files),
		Goal:         strings.TrimSpace(request.Goal),
		AuthorID:     strconv.FormatUint(user.ID, 10),
		ReviewStatus: cloudhub.OpenClawReviewPending,
		CreatedAt:    now,
		Files:        files,
	}

	created, err := s.Store.OpenClawSkills(ctx).Create(ctx, skill, revision)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	encodeJSON(w, http.StatusCreated, openClawSkillToDTO(*created), s.Logger)
}

// OpenClawSkillRevisionCreate appends a revision. The request carries the
// complete file set: a revision replaces its predecessor rather than patching
// it, so a file left out is a file removed.
func (s *Service) OpenClawSkillRevisionCreate(w http.ResponseWriter, r *http.Request) {
	ctx, user, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	id := httprouter.GetParamFromContext(ctx, "id")

	var request openClawSkillRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}
	if err := validateOpenClawSkillFiles(request.Main, openClawSupportFromDTO(request.SupportFiles)); err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}

	store := s.Store.OpenClawSkills(ctx)
	skill, err := store.Get(ctx, orgID, id)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	name, _, err := openClawFrontmatter(request.Main)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}
	// Renaming through a revision would leave the Gateway holding the old
	// skill under its old name with nothing pointing at it.
	if name != skill.Name {
		Error(w, http.StatusUnprocessableEntity,
			fmt.Sprintf("frontmatter name %q does not match the skill name %q", name, skill.Name), s.Logger)
		return
	}

	files := openClawSkillFiles(request.Main, request.SupportFiles)
	treeHash := openClawTreeHash(files)

	existing, err := store.Revisions(ctx, orgID, id)
	if err != nil {
		Error(w, http.StatusBadGateway, "unable to read revisions", s.Logger)
		return
	}
	if len(existing) > 0 && existing[0].TreeHash == treeHash {
		Error(w, http.StatusUnprocessableEntity, "this revision is identical to the previous one", s.Logger)
		return
	}

	revisionID, err := (&idgen.UUID{}).Generate()
	if err != nil {
		internalServerError(w, err, s.Logger)
		return
	}
	revision := &cloudhub.OpenClawSkillRevision{
		ID:           revisionID,
		TreeHash:     treeHash,
		Goal:         strings.TrimSpace(request.Goal),
		AuthorID:     strconv.FormatUint(user.ID, 10),
		ReviewStatus: cloudhub.OpenClawReviewPending,
		CreatedAt:    time.Now().UTC(),
		Files:        files,
	}
	added, err := store.AddRevision(ctx, orgID, id, revision)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	encodeJSON(w, http.StatusCreated, added, s.Logger)
}

// approveDeps is what approving one revision needs. Pulling it out of the
// handler keeps the ordering rule — publish first, record second — testable
// without an HTTP server or a store.
type approveDeps struct {
	publisher    openClawSkillPublisher
	agentID      string
	skillName    string
	files        []cloudhub.OpenClawSkillFile
	reviewedBy   string
	note         string
	recordReview func(cloudhub.OpenClawSkillReview) error
	activate     func() error
}

// publishOpenClawRevision writes one revision's files into an agent workspace.
//
// It is shared by approval and by making an earlier revision current again:
// both have to put the same bytes in front of the agent, and only what
// CloudHub records afterwards differs.
func publishOpenClawRevision(
	ctx context.Context,
	publisher openClawSkillPublisher,
	agentID, skillName string,
	files []cloudhub.OpenClawSkillFile,
) (openclaw.PublishResult, error) {
	var main string
	support := make([]openclaw.SkillFile, 0, len(files))
	for _, file := range files {
		if file.Path == openClawMainPath {
			main = file.Content
			continue
		}
		support = append(support, openclaw.SkillFile{Path: file.Path, Content: file.Content})
	}
	if main == "" {
		return openclaw.PublishResult{}, fmt.Errorf("revision has no %s", openClawMainPath)
	}
	_, description, err := openClawFrontmatter(main)
	if err != nil {
		return openclaw.PublishResult{}, err
	}

	return publisher.Publish(ctx, agentID, openclaw.SkillPayload{
		Name:        skillName,
		Description: description,
		Main:        main,
		Support:     support,
	})
}

// approveOpenClawRevision publishes a revision and only then records the
// approval. If the Gateway refuses the publish the revision stays pending, so
// a retry is safe and CloudHub never claims an approval the Gateway did not
// take.
func approveOpenClawRevision(ctx context.Context, deps approveDeps) error {
	result, err := publishOpenClawRevision(ctx, deps.publisher, deps.agentID, deps.skillName, deps.files)
	if err != nil {
		return err
	}

	if err := deps.recordReview(cloudhub.OpenClawSkillReview{
		Status:     cloudhub.OpenClawReviewApproved,
		ReviewedBy: deps.reviewedBy,
		ReviewedAt: time.Now().UTC(),
		Note:       deps.note,
		ProposalID: result.ProposalID,
		Scan:       result.Scan,
	}); err != nil {
		return err
	}
	return deps.activate()
}

type openClawReviewRequest struct {
	Note string `json:"note"`
}

type openClawRollbackRequest struct {
	ToRevision int `json:"toRevision"`
}

// openClawRevisionParam reads the :rev path segment.
func openClawRevisionParam(ctx context.Context) (int, error) {
	return strconv.Atoi(httprouter.GetParamFromContext(ctx, "rev"))
}

// OpenClawSkillRevisionGet returns one revision with its complete file set.
// The history listing omits file contents, and a new revision replaces the
// whole file set rather than patching it, so an editor has to read the current
// files back before it can submit a change.
func (s *Service) OpenClawSkillRevisionGet(w http.ResponseWriter, r *http.Request) {
	ctx, _, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	id := httprouter.GetParamFromContext(ctx, "id")
	revision, err := openClawRevisionParam(ctx)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, "revision must be a number", s.Logger)
		return
	}

	rev, err := s.Store.OpenClawSkills(ctx).Revision(ctx, orgID, id, revision)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	encodeJSON(w, http.StatusOK, rev, s.Logger)
}

// OpenClawSkillRevisionApprove publishes a revision to the organization's
// execution agent and records the approval.
func (s *Service) OpenClawSkillRevisionApprove(w http.ResponseWriter, r *http.Request) {
	ctx, user, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	if s.OpenClawSkillPublisher == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
		return
	}
	id := httprouter.GetParamFromContext(ctx, "id")
	revision, err := openClawRevisionParam(ctx)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, "revision must be a number", s.Logger)
		return
	}

	var request openClawReviewRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}

	store := s.Store.OpenClawSkills(ctx)
	skill, err := store.Get(ctx, orgID, id)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	rev, err := store.Revision(ctx, orgID, id, revision)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	agentID, err := s.openClawAgentFor(ctx, orgID, cloudhub.OpenClawAgentExecution)
	if err != nil {
		s.openClawAgentMappingError(w, err, cloudhub.OpenClawAgentExecution)
		return
	}

	if err := approveOpenClawRevision(ctx, approveDeps{
		publisher:  s.OpenClawSkillPublisher,
		agentID:    agentID,
		skillName:  skill.Name,
		files:      rev.Files,
		reviewedBy: strconv.FormatUint(user.ID, 10),
		note:       strings.TrimSpace(request.Note),
		recordReview: func(review cloudhub.OpenClawSkillReview) error {
			return store.UpdateRevisionReview(ctx, orgID, id, revision, review)
		},
		activate: func() error {
			return store.SetActiveRevision(ctx, orgID, id, revision)
		},
	}); err != nil {
		s.openClawGatewayError(w, err)
		return
	}

	updated, err := store.Revision(ctx, orgID, id, revision)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	encodeJSON(w, http.StatusOK, updated, s.Logger)
}

// OpenClawSkillRevisionReject records a rejection. The note is required: a
// rejection without a reason gives the author nothing to act on.
func (s *Service) OpenClawSkillRevisionReject(w http.ResponseWriter, r *http.Request) {
	ctx, user, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	id := httprouter.GetParamFromContext(ctx, "id")
	revision, err := openClawRevisionParam(ctx)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, "revision must be a number", s.Logger)
		return
	}

	var request openClawReviewRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}
	note := strings.TrimSpace(request.Note)
	if note == "" {
		Error(w, http.StatusUnprocessableEntity, "a rejection note is required", s.Logger)
		return
	}

	store := s.Store.OpenClawSkills(ctx)
	if err := store.UpdateRevisionReview(ctx, orgID, id, revision, cloudhub.OpenClawSkillReview{
		Status:     cloudhub.OpenClawReviewRejected,
		ReviewedBy: strconv.FormatUint(user.ID, 10),
		ReviewedAt: time.Now().UTC(),
		Note:       note,
	}); err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	updated, err := store.Revision(ctx, orgID, id, revision)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	encodeJSON(w, http.StatusOK, updated, s.Logger)
}

// OpenClawSkillRollback makes an earlier revision the live one again.
//
// It moves a pointer rather than writing history: the revision keeps its own
// identity and its original approval record, and only the skill's active
// revision changes. Copying the content forward as a new revision, which is
// what this used to do, produced a revision identical to one already stored -
// the very thing a normal revision submit is refused for.
//
// The files still have to be pushed to the Gateway: its apply writes a skill's
// files by name and has no notion of selecting an older version.
func (s *Service) OpenClawSkillRollback(w http.ResponseWriter, r *http.Request) {
	ctx, _, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	if s.OpenClawSkillPublisher == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw gateway is not configured", s.Logger)
		return
	}
	id := httprouter.GetParamFromContext(ctx, "id")

	var request openClawRollbackRequest
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}
	if request.ToRevision <= 0 {
		Error(w, http.StatusUnprocessableEntity, "toRevision must be a positive number", s.Logger)
		return
	}

	store := s.Store.OpenClawSkills(ctx)
	skill, err := store.Get(ctx, orgID, id)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	if request.ToRevision == skill.ActiveRevision {
		Error(w, http.StatusUnprocessableEntity, "that revision is already the live one", s.Logger)
		return
	}
	source, err := store.Revision(ctx, orgID, id, request.ToRevision)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	// Making a revision live that was never approved would bypass review.
	// Publishing an unreviewed revision is what the approve endpoint is for.
	if source.ReviewStatus != cloudhub.OpenClawReviewApproved {
		Error(w, http.StatusUnprocessableEntity,
			"only a revision that has been applied before can be made live again", s.Logger)
		return
	}

	agentID, err := s.openClawAgentFor(ctx, orgID, cloudhub.OpenClawAgentExecution)
	if err != nil {
		s.openClawAgentMappingError(w, err, cloudhub.OpenClawAgentExecution)
		return
	}

	// The pointer moves only after the Gateway has the files, so a failed
	// publish leaves CloudHub pointing at what the agent still runs.
	if _, err := publishOpenClawRevision(ctx, s.OpenClawSkillPublisher, agentID, skill.Name, source.Files); err != nil {
		s.openClawGatewayError(w, err)
		return
	}
	if err := store.SetActiveRevision(ctx, orgID, id, source.Revision); err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}

	updated, err := store.Revision(ctx, orgID, id, source.Revision)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	encodeJSON(w, http.StatusOK, updated, s.Logger)
}

// OpenClawSkillDelete removes a skill completely: its files leave the agent
// workspace and its whole revision history leaves CloudHub.
//
// The workspace is cleared first. If that call fails the skill stays here for
// an administrator to retry; deleting the record first would leave files an
// agent still loads with nothing in CloudHub naming them.
func (s *Service) OpenClawSkillDelete(w http.ResponseWriter, r *http.Request) {
	ctx, _, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	if s.OpenClawSkillDeleter == nil {
		Error(w, http.StatusServiceUnavailable, "OpenClaw skill-admin server is not configured", s.Logger)
		return
	}
	id := httprouter.GetParamFromContext(ctx, "id")

	store := s.Store.OpenClawSkills(ctx)
	skill, err := store.Get(ctx, orgID, id)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	agentID, err := s.openClawAgentFor(ctx, orgID, cloudhub.OpenClawAgentExecution)
	if err != nil {
		s.openClawAgentMappingError(w, err, cloudhub.OpenClawAgentExecution)
		return
	}

	if err := s.OpenClawSkillDeleter.Delete(ctx, agentID, skill.Name); err != nil {
		s.openClawGatewayError(w, err)
		return
	}
	if err := store.Delete(ctx, orgID, id); err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// OpenClawSkillRevisionDelete removes one revision from a skill's history.
//
// Nothing is sent to the Gateway. It holds one file set per skill name, the
// one the active revision published, and that revision cannot be deleted -
// so there is never a Gateway copy corresponding to what this removes.
func (s *Service) OpenClawSkillRevisionDelete(w http.ResponseWriter, r *http.Request) {
	ctx, _, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	id := httprouter.GetParamFromContext(ctx, "id")
	revision, err := openClawRevisionParam(ctx)
	if err != nil {
		Error(w, http.StatusUnprocessableEntity, "revision must be a number", s.Logger)
		return
	}

	store := s.Store.OpenClawSkills(ctx)
	skill, err := store.Get(ctx, orgID, id)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}

	// The active revision is the one the agent is running, and active_revision
	// is a plain number with no foreign key behind it - deleting its row would
	// leave the skill pointing at history that no longer exists.
	if revision == skill.ActiveRevision {
		Error(w, http.StatusUnprocessableEntity,
			"the revision in use cannot be deleted; make another revision live first", s.Logger)
		return
	}

	revisions, err := store.Revisions(ctx, orgID, id)
	if err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	// A skill with no revisions has no files and no description - there would
	// be nothing left to show or to publish. Removing the last one is deleting
	// the skill, and that is a different request with different consequences.
	if len(revisions) <= 1 {
		Error(w, http.StatusUnprocessableEntity,
			"the only revision cannot be deleted; delete the skill instead", s.Logger)
		return
	}

	if err := store.DeleteRevision(ctx, orgID, id, revision); err != nil {
		s.openClawSkillStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

const maxOpenClawAgentIDLength = 200

type openClawOrgAgentsDTO struct {
	Agents map[string]string `json:"agents"`
}

// validateOpenClawOrgAgents checks the mapping an Admin submits. Whether the
// agent exists on the Gateway is deliberately not checked: Gateway
// configuration changes on its own schedule, and verifying here would make
// this write fail whenever the Gateway is unreachable.
func validateOpenClawOrgAgents(agents map[string]string) error {
	for purpose, agentID := range agents {
		switch purpose {
		case cloudhub.OpenClawAgentAuthoring, cloudhub.OpenClawAgentExecution:
		default:
			return fmt.Errorf("unknown agent purpose %q", purpose)
		}
		trimmed := strings.TrimSpace(agentID)
		if trimmed == "" {
			return fmt.Errorf("agent id for %q is required", purpose)
		}
		if len(trimmed) > maxOpenClawAgentIDLength {
			return fmt.Errorf("agent id for %q exceeds %d characters", purpose, maxOpenClawAgentIDLength)
		}
	}
	return nil
}

// OpenClawOrgAgentsGet returns the organization's agent mapping.
func (s *Service) OpenClawOrgAgentsGet(w http.ResponseWriter, r *http.Request) {
	ctx, _, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	store := s.Store.OpenClawOrgAgents(ctx)
	agents := map[string]string{}
	for _, purpose := range []string{cloudhub.OpenClawAgentAuthoring, cloudhub.OpenClawAgentExecution} {
		agentID, err := store.Get(ctx, orgID, purpose)
		if errors.Is(err, cloudhub.ErrOpenClawAgentNotMapped) {
			continue
		}
		if err != nil {
			Error(w, http.StatusBadGateway, "unable to read the agent mapping", s.Logger)
			return
		}
		agents[purpose] = agentID
	}
	encodeJSON(w, http.StatusOK, openClawOrgAgentsDTO{Agents: agents}, s.Logger)
}

// OpenClawOrgAgentsReplace swaps the organization's whole mapping. A purpose
// left out of the request is removed.
func (s *Service) OpenClawOrgAgentsReplace(w http.ResponseWriter, r *http.Request) {
	ctx, _, orgID, ok := s.openClawOwnerContext(r)
	if !ok {
		Error(w, http.StatusUnauthorized, "authenticated organization context required", s.Logger)
		return
	}
	var request openClawOrgAgentsDTO
	if err := decodeOpenClawJSON(w, r, &request); err != nil {
		s.openClawRequestError(w, err)
		return
	}
	if request.Agents == nil {
		request.Agents = map[string]string{}
	}
	if err := validateOpenClawOrgAgents(request.Agents); err != nil {
		Error(w, http.StatusUnprocessableEntity, err.Error(), s.Logger)
		return
	}
	trimmed := make(map[string]string, len(request.Agents))
	for purpose, agentID := range request.Agents {
		trimmed[purpose] = strings.TrimSpace(agentID)
	}
	if err := s.Store.OpenClawOrgAgents(ctx).Replace(ctx, orgID, trimmed); err != nil {
		Error(w, http.StatusBadGateway, "unable to store the agent mapping", s.Logger)
		return
	}
	encodeJSON(w, http.StatusOK, openClawOrgAgentsDTO{Agents: trimmed}, s.Logger)
}
