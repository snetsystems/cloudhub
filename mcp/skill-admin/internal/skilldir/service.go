// Package skilldir removes OpenClaw workspace skill directories.
//
// The Gateway exposes no API that deletes an applied skill, so CloudHub
// retires one by asking this tool to remove its directory from the workspace.
// Deletion cannot be undone, so every input is checked against an explicit
// allowlist rather than inferred.
package skilldir

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// ErrorCode names a failure in a form the caller can branch on.
type ErrorCode string

const (
	ErrorInvalidAgentID     ErrorCode = "invalid_agent_id"
	ErrorInvalidSkillName   ErrorCode = "invalid_skill_name"
	ErrorPathEscape         ErrorCode = "path_escape"
	ErrorSymlinkRejected    ErrorCode = "symlink_rejected"
	ErrorNotASkillDirectory ErrorCode = "not_a_skill_directory"
	ErrorDeleteFailed       ErrorCode = "delete_failed"
)

// maxSkillNameLength matches the authoring validation in CloudHub.
const maxSkillNameLength = 64

// maxAgentIDLength bounds the directory name resolved under the workspace root.
const maxAgentIDLength = 100

// agentIDPattern is the shape the Gateway gives an agent id. Re-applying it
// here keeps a malformed id from reaching a path join, and rules out ".",
// ".." and separators on its own.
var agentIDPattern = regexp.MustCompile(`^[a-z][a-z0-9_-]*$`)

// skillNamePattern is the same expression CloudHub applies when a skill is
// authored. Re-applying it here keeps a malformed name from ever reaching a
// path join, and rules out ".", ".." and separators on its own.
var skillNamePattern = regexp.MustCompile(`^[a-z][a-z0-9_-]*$`)

// Error carries an ErrorCode alongside a human-readable message.
type Error struct {
	Code    ErrorCode
	Message string
}

func (e *Error) Error() string { return e.Message }

func newError(code ErrorCode, format string, args ...any) *Error {
	return &Error{Code: code, Message: fmt.Sprintf(format, args...)}
}

// CodeOf reports the ErrorCode carried by err, or "" if err is not an *Error.
func CodeOf(err error) ErrorCode {
	var serviceErr *Error
	if errors.As(err, &serviceErr) {
		return serviceErr.Code
	}
	return ""
}

// DeleteInput asks for one skill directory to be removed.
type DeleteInput struct {
	AgentID   string `json:"agentId" jsonschema:"the agent whose workspace holds the skill"`
	SkillName string `json:"skillName" jsonschema:"the skill directory name under the workspace skills root"`
}

// DeleteResult reports what was removed. Deleted is false when the skill was
// already absent, which is a success.
type DeleteResult struct {
	AgentID   string   `json:"agentId"`
	SkillName string   `json:"skillName"`
	Path      string   `json:"path"`
	Deleted   bool     `json:"deleted"`
	FileCount int      `json:"fileCount"`
	Files     []string `json:"files,omitempty"`
}

// LogFunc records what the service is about to destroy.
type LogFunc func(format string, args ...any)

// Service deletes skill directories and whole workspaces beneath one root.
type Service struct {
	workspaceRoot string
	logf          LogFunc
}

// NewService resolves every target under workspaceRoot.
//
// An agent's workspace is <workspaceRoot>/<agentId>, matching how CloudHub
// provisions them. A per-agent allowlist is not workable: CloudHub creates an
// organization's agent at runtime and cannot rewrite this server's
// configuration to add it. Containment is enforced per call instead, and only
// this root is mounted, so nothing outside it is reachable.
func NewService(workspaceRoot string, logf LogFunc) (*Service, error) {
	workspaceRoot = strings.TrimSpace(workspaceRoot)
	if !filepath.IsAbs(workspaceRoot) {
		return nil, fmt.Errorf("workspace root must be an absolute path, got %q", workspaceRoot)
	}
	if logf == nil {
		logf = func(string, ...any) {}
	}
	return &Service{workspaceRoot: filepath.Clean(workspaceRoot), logf: logf}, nil
}

// WorkspaceRoot is the directory every target is resolved under.
func (s *Service) WorkspaceRoot() string { return s.workspaceRoot }

// workspaceFor resolves an agent's workspace, refusing anything that is not a
// plain directory name.
func (s *Service) workspaceFor(agentID string) (string, error) {
	if len(agentID) > maxAgentIDLength || !agentIDPattern.MatchString(agentID) {
		return "", newError(ErrorInvalidAgentID, "agent id %q is not a valid workspace directory name", agentID)
	}
	return filepath.Join(s.workspaceRoot, agentID), nil
}

// Delete removes <workspace>/skills/<skillName>/ and everything under it.
//
// It succeeds when the directory is already gone so that a retried retirement
// does not look like a failure.
func (s *Service) Delete(_ context.Context, input DeleteInput) (DeleteResult, error) {
	workspace, err := s.workspaceFor(input.AgentID)
	if err != nil {
		return DeleteResult{}, err
	}
	if len(input.SkillName) > maxSkillNameLength || !skillNamePattern.MatchString(input.SkillName) {
		return DeleteResult{}, newError(ErrorInvalidSkillName, "skill name %q is not a valid skill directory name", input.SkillName)
	}

	skillsRoot := filepath.Join(workspace, "skills")
	// Resolve the root through any symlinks so that containment is checked
	// against the real directory rather than a link that may point elsewhere.
	realSkillsRoot, err := filepath.EvalSymlinks(skillsRoot)
	if err != nil {
		if os.IsNotExist(err) {
			return DeleteResult{AgentID: input.AgentID, SkillName: input.SkillName, Path: filepath.Join(skillsRoot, input.SkillName)}, nil
		}
		return DeleteResult{}, newError(ErrorDeleteFailed, "resolve skills root: %v", err)
	}

	target := filepath.Join(realSkillsRoot, input.SkillName)
	result := DeleteResult{AgentID: input.AgentID, SkillName: input.SkillName, Path: target}

	info, err := os.Lstat(target)
	if err != nil {
		if os.IsNotExist(err) {
			return result, nil
		}
		return DeleteResult{}, newError(ErrorDeleteFailed, "inspect %s: %v", target, err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return DeleteResult{}, newError(ErrorSymlinkRejected, "%s is a symbolic link", target)
	}
	if !info.IsDir() {
		return DeleteResult{}, newError(ErrorNotASkillDirectory, "%s is not a directory", target)
	}
	// Defence in depth. The name pattern already rules out separators and
	// "..", so reaching this is a programming error rather than user input.
	if parent := filepath.Dir(target); parent != realSkillsRoot {
		return DeleteResult{}, newError(ErrorPathEscape, "%s is outside %s", target, realSkillsRoot)
	}
	if target == realSkillsRoot || target == filepath.Clean(workspace) {
		return DeleteResult{}, newError(ErrorPathEscape, "refusing to delete %s", target)
	}

	files, err := listFiles(target)
	if err != nil {
		return DeleteResult{}, newError(ErrorDeleteFailed, "list %s: %v", target, err)
	}
	s.logf("deleting workspace skill agent=%s skill=%s path=%s files=%d %v",
		input.AgentID, input.SkillName, target, len(files), files)

	if err := os.RemoveAll(target); err != nil {
		return DeleteResult{}, newError(ErrorDeleteFailed, "delete %s: %v", target, err)
	}

	result.Deleted = true
	result.FileCount = len(files)
	result.Files = files
	return result, nil
}

// listFiles returns the paths under root, relative to root, so the log and the
// result record exactly what was removed.
func listFiles(root string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		files = append(files, relative)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

// DeleteWorkspaceInput asks for one agent's whole workspace to be removed.
type DeleteWorkspaceInput struct {
	AgentID string `json:"agentId" jsonschema:"the agent whose workspace should be removed"`
}

// DeleteWorkspaceResult reports what was removed. Deleted is false when the
// workspace was already absent, which is a success.
type DeleteWorkspaceResult struct {
	AgentID   string `json:"agentId"`
	Path      string `json:"path"`
	Deleted   bool   `json:"deleted"`
	FileCount int    `json:"fileCount"`
}

// DeleteWorkspace removes <workspaceRoot>/<agentId> and everything under it.
//
// This is how an organization's workspace is reclaimed when it is deleted:
// the Gateway's agents.delete removes the agent's config entry but leaves the
// directory on disk.
//
// Unlike Delete, the file list is not returned - a workspace holds every skill
// an organization ever had - but it is counted and the removal is logged.
func (s *Service) DeleteWorkspace(_ context.Context, input DeleteWorkspaceInput) (DeleteWorkspaceResult, error) {
	target, err := s.workspaceFor(input.AgentID)
	if err != nil {
		return DeleteWorkspaceResult{}, err
	}
	result := DeleteWorkspaceResult{AgentID: input.AgentID, Path: target}

	info, err := os.Lstat(target)
	if err != nil {
		if os.IsNotExist(err) {
			return result, nil
		}
		return DeleteWorkspaceResult{}, newError(ErrorDeleteFailed, "inspect %s: %v", target, err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return DeleteWorkspaceResult{}, newError(ErrorSymlinkRejected, "%s is a symbolic link", target)
	}
	if !info.IsDir() {
		return DeleteWorkspaceResult{}, newError(ErrorNotASkillDirectory, "%s is not a directory", target)
	}
	// The agent id pattern already rules out separators and "..", so the
	// parent can only be the root unless something has gone very wrong.
	if filepath.Dir(target) != s.workspaceRoot || target == s.workspaceRoot {
		return DeleteWorkspaceResult{}, newError(ErrorPathEscape, "refusing to delete %s", target)
	}

	files, err := listFiles(target)
	if err != nil {
		return DeleteWorkspaceResult{}, newError(ErrorDeleteFailed, "list %s: %v", target, err)
	}
	s.logf("deleting agent workspace agent=%s path=%s files=%d", input.AgentID, target, len(files))

	if err := os.RemoveAll(target); err != nil {
		return DeleteWorkspaceResult{}, newError(ErrorDeleteFailed, "delete %s: %v", target, err)
	}
	result.Deleted = true
	result.FileCount = len(files)
	return result, nil
}
