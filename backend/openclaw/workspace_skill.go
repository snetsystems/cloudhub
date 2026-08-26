package openclaw

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// A workspace skill is read over RPC, one file per call, so these bounds keep
// a single oversized directory from turning one page view into hundreds of
// round trips. They are looser than what CloudHub validates an authored skill
// against: this reads what the agent already holds, whatever that is.
const (
	maxWorkspaceSkillFiles = 60
	maxWorkspaceSkillBytes = 1 << 20
	maxWorkspaceSkillDepth = 3
)

// workspaceSkillName is the shape a skill directory name has. It is applied
// before the name reaches a path so that "." and ".." cannot.
var workspaceSkillName = regexp.MustCompile(`^[a-z][a-z0-9_-]*$`)

// WorkspaceSkill reads one skill's files out of an agent's workspace.
//
// This is the only way to see a baseline skill's content. Those skills are
// copied into the workspace as files and have no CloudHub record, so the
// Gateway is where they are known - and the skill inventory reports only that
// they exist, not what they say.
//
// Paths are relative to the skill's own directory, so the result carries
// "SKILL.md" rather than "skills/<name>/SKILL.md".
func (p *SkillPublisher) WorkspaceSkill(ctx context.Context, agentID, name string) ([]SkillFile, error) {
	if len(name) > 64 || !workspaceSkillName.MatchString(name) {
		return nil, fmt.Errorf("openclaw: %q is not a usable skill name", name)
	}

	root := "skills/" + name
	files, _, err := p.readWorkspaceDir(ctx, agentID, root, root, 0)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("openclaw: agent %q holds no skill named %q", agentID, name)
	}
	return files, nil
}

// readWorkspaceDir collects the files under dir, with paths made relative to
// root. The second result is the running byte total, which bounds the walk.
func (p *SkillPublisher) readWorkspaceDir(
	ctx context.Context,
	agentID, root, dir string,
	total int,
) ([]SkillFile, int, error) {
	if strings.Count(strings.TrimPrefix(dir, root), "/") > maxWorkspaceSkillDepth {
		return nil, total, nil
	}

	raw, err := p.rpc.Call(ctx, "agents.workspace.list", map[string]interface{}{
		"agentId": agentID,
		"path":    dir,
	})
	if err != nil {
		return nil, total, err
	}
	var listing struct {
		Entries []struct {
			Path string `json:"path"`
			Kind string `json:"kind"`
		} `json:"entries"`
	}
	if err := json.Unmarshal(raw, &listing); err != nil {
		return nil, total, fmt.Errorf("%w: decode agents.workspace.list response: %v", ErrProtocol, err)
	}

	var files []SkillFile
	for _, entry := range listing.Entries {
		if entry.Kind == "directory" {
			nested, nestedTotal, err := p.readWorkspaceDir(ctx, agentID, root, entry.Path, total)
			if err != nil {
				return nil, total, err
			}
			files = append(files, nested...)
			total = nestedTotal
			continue
		}

		content, ok, err := p.readWorkspaceFile(ctx, agentID, entry.Path)
		if err != nil {
			return nil, total, err
		}
		// A file the Gateway hands back base64-encoded is binary. A skill
		// cannot carry one, and showing it as text would be a lie.
		if !ok {
			continue
		}

		total += len(content)
		if len(files) >= maxWorkspaceSkillFiles || total > maxWorkspaceSkillBytes {
			return nil, total, fmt.Errorf("openclaw: skill %q is too large to read", root)
		}
		files = append(files, SkillFile{
			Path:    strings.TrimPrefix(strings.TrimPrefix(entry.Path, root), "/"),
			Content: content,
		})
	}
	return files, total, nil
}

// readWorkspaceFile reads one file. The second result is false when the
// Gateway returned something that is not UTF-8 text.
func (p *SkillPublisher) readWorkspaceFile(ctx context.Context, agentID, path string) (string, bool, error) {
	raw, err := p.rpc.Call(ctx, "agents.workspace.get", map[string]interface{}{
		"agentId": agentID,
		"path":    path,
	})
	if err != nil {
		return "", false, err
	}
	var result struct {
		File struct {
			Encoding string `json:"encoding"`
			Content  string `json:"content"`
		} `json:"file"`
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return "", false, fmt.Errorf("%w: decode agents.workspace.get response: %v", ErrProtocol, err)
	}
	if result.File.Encoding != "utf8" {
		return "", false, nil
	}
	return result.File.Content, true, nil
}
