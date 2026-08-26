package skilldir

import (
	"context"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

// Copy exists because the Gateway's two ways of taking a skill do not accept
// the same thing. skills.proposals.* caps a description at 160 bytes; a skill
// placed in a workspace as files is read by a different path with no such cap,
// which is how the Gateway's own operational skills - 200 to 800 bytes of
// description - came to exist. Baseline skills are the second kind, so they
// are copied rather than proposed.
//
// These bounds keep one mistake in the template from being written into every
// organization that gets provisioned.
const (
	maxCopiedSkills     = 50
	maxCopiedFiles      = 200
	maxCopiedTotalBytes = 8 << 20
)

// copiedFileMode is what a copied file is written as. The Gateway reads these
// files and never executes them directly, so the source's executable bit is
// not carried over.
const copiedFileMode fs.FileMode = 0o644

// Additional failure codes for copying.
const (
	ErrorCopyFailed    ErrorCode = "copy_failed"
	ErrorSameWorkspace ErrorCode = "same_workspace"
	ErrorCopyTooLarge  ErrorCode = "copy_too_large"
)

// CopyInput asks for every skill in one agent's workspace to be placed in
// another's.
type CopyInput struct {
	SourceAgentID string `json:"sourceAgentId" jsonschema:"the agent whose skills are the template"`
	TargetAgentID string `json:"targetAgentId" jsonschema:"the agent the skills are copied into"`
}

// CopyResult reports what was placed. Skipped names were already present in
// the target and were left untouched.
type CopyResult struct {
	SourceAgentID string   `json:"sourceAgentId"`
	TargetAgentID string   `json:"targetAgentId"`
	Copied        []string `json:"copied"`
	Skipped       []string `json:"skipped,omitempty"`
	FileCount     int      `json:"fileCount"`
}

// Copy places each skill directory from the source workspace into the target,
// leaving any that the target already has.
//
// A skill already in the target is never overwritten. The target may be an
// organization that edited or retired what it inherited, and re-copying would
// undo that. An absent source is a success with nothing copied, so a
// deployment with no template still provisions agents.
func (s *Service) Copy(_ context.Context, input CopyInput) (CopyResult, error) {
	sourceWorkspace, err := s.workspaceFor(input.SourceAgentID)
	if err != nil {
		return CopyResult{}, err
	}
	targetWorkspace, err := s.workspaceFor(input.TargetAgentID)
	if err != nil {
		return CopyResult{}, err
	}
	if input.SourceAgentID == input.TargetAgentID {
		return CopyResult{}, newError(ErrorSameWorkspace, "source and target are the same workspace")
	}

	result := CopyResult{SourceAgentID: input.SourceAgentID, TargetAgentID: input.TargetAgentID, Copied: []string{}}

	sourceSkills := filepath.Join(sourceWorkspace, "skills")
	entries, err := os.ReadDir(sourceSkills)
	if err != nil {
		if os.IsNotExist(err) {
			return result, nil
		}
		return CopyResult{}, newError(ErrorCopyFailed, "read %s: %v", sourceSkills, err)
	}

	targetSkills := filepath.Join(targetWorkspace, "skills")
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		if len(name) > maxSkillNameLength || !skillNamePattern.MatchString(name) {
			return CopyResult{}, newError(ErrorInvalidSkillName, "template holds %q, which is not a valid skill directory name", name)
		}
		if len(result.Copied) == maxCopiedSkills {
			break
		}

		// A directory without SKILL.md is not a skill. The Gateway ignores it,
		// so copying it forward would only spread the mistake.
		if _, err := os.Stat(filepath.Join(sourceSkills, name, "SKILL.md")); err != nil {
			continue
		}
		if _, err := os.Lstat(filepath.Join(targetSkills, name)); err == nil {
			result.Skipped = append(result.Skipped, name)
			continue
		}

		files, err := s.copySkill(filepath.Join(sourceSkills, name), filepath.Join(targetSkills, name))
		if err != nil {
			return CopyResult{}, err
		}
		result.Copied = append(result.Copied, name)
		result.FileCount += files
	}

	s.logf("copied baseline skills source=%s target=%s copied=%v skipped=%v files=%d",
		input.SourceAgentID, input.TargetAgentID, result.Copied, result.Skipped, result.FileCount)
	return result, nil
}

// copySkill writes one skill directory into place, and removes a partial copy
// rather than leaving a skill the Gateway would load with files missing.
func (s *Service) copySkill(source, target string) (int, error) {
	files, err := s.writeTree(source, target)
	if err != nil {
		_ = os.RemoveAll(target)
		return 0, err
	}
	return files, nil
}

func (s *Service) writeTree(source, target string) (int, error) {
	files := 0
	total := int64(0)

	err := filepath.WalkDir(source, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return newError(ErrorCopyFailed, "walk %s: %v", source, err)
		}
		relative, err := filepath.Rel(source, path)
		if err != nil {
			return newError(ErrorCopyFailed, "resolve %s: %v", path, err)
		}
		destination := filepath.Join(target, relative)

		// A symlink is refused rather than followed: the template is a
		// directory of files, and a link could reach outside the mounted root.
		if entry.Type()&fs.ModeSymlink != 0 {
			return newError(ErrorSymlinkRejected, "%s is a symbolic link", path)
		}
		if entry.IsDir() {
			return os.MkdirAll(destination, 0o755)
		}
		if !entry.Type().IsRegular() {
			return newError(ErrorCopyFailed, "%s is not a regular file", path)
		}

		info, err := entry.Info()
		if err != nil {
			return newError(ErrorCopyFailed, "stat %s: %v", path, err)
		}
		files++
		total += info.Size()
		if files > maxCopiedFiles || total > maxCopiedTotalBytes {
			return newError(ErrorCopyTooLarge, "template skill %s is too large to copy", filepath.Base(source))
		}
		return copyFile(path, destination)
	})
	if err != nil {
		return 0, err
	}
	return files, nil
}

func copyFile(source, destination string) error {
	in, err := os.Open(source)
	if err != nil {
		return newError(ErrorCopyFailed, "open %s: %v", source, err)
	}
	defer in.Close()

	out, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, copiedFileMode)
	if err != nil {
		return newError(ErrorCopyFailed, "create %s: %v", destination, err)
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return newError(ErrorCopyFailed, "write %s: %v", destination, err)
	}
	if err := out.Close(); err != nil {
		return newError(ErrorCopyFailed, "close %s: %v", destination, err)
	}
	return nil
}

