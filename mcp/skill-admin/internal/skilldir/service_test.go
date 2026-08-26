package skilldir

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// newWorkspace lays out a workspace the way the Gateway does: skills live in
// <workspace>/skills/<name>/.
func newWorkspace(t *testing.T) (root string, service *Service) {
	t.Helper()
	root = filepath.Join(t.TempDir(), "main")
	if err := os.MkdirAll(filepath.Join(root, "skills"), 0o755); err != nil {
		t.Fatalf("create skills root: %v", err)
	}
	service, err := NewService(filepath.Dir(root), func(string, ...any) {})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return root, service
}

func writeSkill(t *testing.T, root, name string, files map[string]string) string {
	t.Helper()
	dir := filepath.Join(root, "skills", name)
	for path, content := range files {
		full := filepath.Join(dir, path)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatalf("mkdir %s: %v", full, err)
		}
		if err := os.WriteFile(full, []byte(content), 0o600); err != nil {
			t.Fatalf("write %s: %v", full, err)
		}
	}
	return dir
}

// This fails if the tool stops removing the skill directory, stops reporting
// what it removed, or starts leaving files behind.
func TestDeleteRemovesTheSkillDirectory(t *testing.T) {
	root, service := newWorkspace(t)
	dir := writeSkill(t, root, "cpu-report", map[string]string{
		"SKILL.md":           "# cpu report",
		"scripts/collect.sh": "echo hi",
	})
	keep := writeSkill(t, root, "other-skill", map[string]string{"SKILL.md": "# other"})

	result, err := service.Delete(context.Background(), DeleteInput{AgentID: "main", SkillName: "cpu-report"})
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !result.Deleted {
		t.Fatal("Deleted = false, want true")
	}
	if result.FileCount != 2 {
		t.Fatalf("FileCount = %d, want 2", result.FileCount)
	}
	if result.Path != dir {
		t.Fatalf("Path = %q, want %q", result.Path, dir)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatalf("skill directory still present: %v", err)
	}
	if _, err := os.Stat(keep); err != nil {
		t.Fatalf("neighbouring skill was removed: %v", err)
	}
}

// Retiring a skill twice must not fail. CloudHub retries retirement, and a
// second attempt reporting an error would look like a broken retirement.
func TestDeleteIsIdempotentWhenTheSkillIsAbsent(t *testing.T) {
	_, service := newWorkspace(t)

	result, err := service.Delete(context.Background(), DeleteInput{AgentID: "main", SkillName: "never-existed"})
	if err != nil {
		t.Fatalf("Delete(absent): %v", err)
	}
	if result.Deleted {
		t.Fatal("Deleted = true, want false for an absent skill")
	}
	if result.FileCount != 0 {
		t.Fatalf("FileCount = %d, want 0", result.FileCount)
	}
}

// The agent id becomes a directory name under the workspace root, so anything
// that could climb out of it has to be refused before it reaches a path join.
func TestDeleteRejectsAnUnusableAgentID(t *testing.T) {
	_, service := newWorkspace(t)

	// An agent with no workspace on disk is simply absent, which is a
	// success. What must be refused is an id that is not a directory name.
	for _, agentID := range []string{"", "..", "a/b", "/absolute", "UPPER"} {
		_, err := service.Delete(context.Background(), DeleteInput{AgentID: agentID, SkillName: "cpu-report"})
		if code := CodeOf(err); code != ErrorInvalidAgentID {
			t.Fatalf("Delete(agent %q) code = %q, want %q (err=%v)", agentID, code, ErrorInvalidAgentID, err)
		}
	}
}

// Every one of these would delete something outside the skills root if the
// name were joined onto a path unchecked.
func TestDeleteRejectsNamesThatEscapeTheSkillsRoot(t *testing.T) {
	_, service := newWorkspace(t)

	for _, name := range []string{
		"..",
		".",
		"../outside",
		"nested/skill",
		"/absolute",
		"",
		"UPPER",
		"-leading-dash",
		"trailing space ",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := service.Delete(context.Background(), DeleteInput{AgentID: "main", SkillName: name})
			if code := CodeOf(err); code != ErrorInvalidSkillName {
				t.Fatalf("error code = %q, want %q (err=%v)", code, ErrorInvalidSkillName, err)
			}
		})
	}
}

// A symlink named like a skill would otherwise make RemoveAll delete the link
// while leaving the target, or - with a careless implementation - follow it.
func TestDeleteRejectsASymlinkedSkill(t *testing.T) {
	root, service := newWorkspace(t)
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "precious.txt"), []byte("keep"), 0o600); err != nil {
		t.Fatalf("write outside file: %v", err)
	}
	link := filepath.Join(root, "skills", "linked-skill")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	_, err := service.Delete(context.Background(), DeleteInput{AgentID: "main", SkillName: "linked-skill"})
	if code := CodeOf(err); code != ErrorSymlinkRejected {
		t.Fatalf("error code = %q, want %q (err=%v)", code, ErrorSymlinkRejected, err)
	}
	if _, err := os.Stat(filepath.Join(outside, "precious.txt")); err != nil {
		t.Fatalf("symlink target was touched: %v", err)
	}
	if _, err := os.Lstat(link); err != nil {
		t.Fatalf("symlink itself was removed: %v", err)
	}
}

// A file where a skill directory belongs is not a skill. Removing it would be
// deleting something the tool does not understand.
func TestDeleteRejectsANonDirectoryTarget(t *testing.T) {
	root, service := newWorkspace(t)
	file := filepath.Join(root, "skills", "not-a-dir")
	if err := os.WriteFile(file, []byte("x"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	_, err := service.Delete(context.Background(), DeleteInput{AgentID: "main", SkillName: "not-a-dir"})
	if code := CodeOf(err); code != ErrorNotASkillDirectory {
		t.Fatalf("error code = %q, want %q (err=%v)", code, ErrorNotASkillDirectory, err)
	}
	if _, err := os.Stat(file); err != nil {
		t.Fatalf("target file was removed: %v", err)
	}
}

// This fails if the constructor stops rejecting configuration that would let
// the tool run against a relative or missing workspace.
func TestNewServiceRejectsUnusableWorkspaceRoots(t *testing.T) {
	for _, root := range []string{"", "   ", "relative/path"} {
		if _, err := NewService(root, nil); err == nil {
			t.Fatalf("NewService(%q) succeeded, want an error", root)
		}
	}
}

// The service logs what it is about to remove. Losing that log would leave a
// destructive action with no record of what it destroyed.
func TestDeleteLogsTheFilesItRemoves(t *testing.T) {
	root := filepath.Join(t.TempDir(), "main")
	if err := os.MkdirAll(filepath.Join(root, "skills"), 0o755); err != nil {
		t.Fatalf("create skills root: %v", err)
	}
	var logged []string
	service, err := NewService(filepath.Dir(root), func(format string, args ...any) {
		logged = append(logged, format)
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	writeSkill(t, root, "cpu-report", map[string]string{"SKILL.md": "# cpu"})

	if _, err := service.Delete(context.Background(), DeleteInput{AgentID: "main", SkillName: "cpu-report"}); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if len(logged) == 0 {
		t.Fatal("Delete removed a directory without logging anything")
	}
}

func TestCodeOfPassesThroughUnknownErrors(t *testing.T) {
	if code := CodeOf(errors.New("boom")); code != "" {
		t.Fatalf("CodeOf(plain error) = %q, want empty", code)
	}
}

// Reclaiming a workspace is what keeps deleted organizations from accumulating
// on disk: the Gateway's agents.delete removes the config entry but leaves the
// directory.
func TestDeleteWorkspaceStripsTheWorkspaceBackToItsScaffold(t *testing.T) {
	root, service := newWorkspace(t)
	writeSkill(t, root, "cpu-report", map[string]string{"SKILL.md": "# cpu"})
	writeSkill(t, root, "other-skill", map[string]string{"SKILL.md": "# other"})
	if err := os.WriteFile(filepath.Join(root, "AGENTS.md"), []byte("scaffold"), 0o600); err != nil {
		t.Fatalf("write scaffold file: %v", err)
	}

	// A second workspace under the same root must survive.
	neighbour := filepath.Join(filepath.Dir(root), "other-agent")
	if err := os.MkdirAll(neighbour, 0o755); err != nil {
		t.Fatalf("create neighbour: %v", err)
	}

	result, err := service.DeleteWorkspace(context.Background(), DeleteWorkspaceInput{AgentID: "main"})
	if err != nil {
		t.Fatalf("DeleteWorkspace: %v", err)
	}
	if !result.Deleted {
		t.Fatal("Deleted = false, want true")
	}
	// The two skill files are gone; AGENTS.md is scaffolding and does not count.
	if result.FileCount != 2 {
		t.Fatalf("FileCount = %d, want 2", result.FileCount)
	}
	// The scaffold stays. The Gateway keeps its own record that it initialized
	// this workspace: for a day afterwards it refuses to create an agent whose
	// workspace reads as brand new or shows no sign of having survived, so
	// stripping it bare would keep the organization from being provisioned
	// again.
	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatalf("workspace directory was removed: %v", err)
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	if len(names) != 1 || names[0] != "AGENTS.md" {
		t.Fatalf("workspace holds %v, want the scaffold only", names)
	}
	if content, err := os.ReadFile(filepath.Join(root, "AGENTS.md")); err != nil || string(content) != "scaffold" {
		t.Fatalf("AGENTS.md = %q, %v", content, err)
	}
	if _, err := os.Stat(neighbour); err != nil {
		t.Fatalf("neighbouring workspace was removed: %v", err)
	}
}

// Organization deletion may be retried, and the workspace may never have been
// created at all if the organization never used OpenClaw.
func TestDeleteWorkspaceIsIdempotent(t *testing.T) {
	_, service := newWorkspace(t)

	result, err := service.DeleteWorkspace(context.Background(), DeleteWorkspaceInput{AgentID: "never-provisioned"})
	if err != nil {
		t.Fatalf("DeleteWorkspace(absent): %v", err)
	}
	if result.Deleted {
		t.Fatal("Deleted = true, want false for an absent workspace")
	}
}

// Deleting a whole workspace is the widest thing this server does, so the id
// has to be a plain directory name and nothing else.
func TestDeleteWorkspaceRejectsUnusableAgentIDs(t *testing.T) {
	_, service := newWorkspace(t)

	for _, agentID := range []string{"", ".", "..", "../..", "a/b", "/absolute", "UPPER", "-leading"} {
		_, err := service.DeleteWorkspace(context.Background(), DeleteWorkspaceInput{AgentID: agentID})
		if code := CodeOf(err); code != ErrorInvalidAgentID {
			t.Fatalf("DeleteWorkspace(%q) code = %q, want %q (err=%v)", agentID, code, ErrorInvalidAgentID, err)
		}
	}
}

// A symlinked workspace would otherwise delete whatever it points at.
func TestDeleteWorkspaceRejectsASymlink(t *testing.T) {
	root, service := newWorkspace(t)
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "precious.txt"), []byte("keep"), 0o600); err != nil {
		t.Fatalf("write outside file: %v", err)
	}
	link := filepath.Join(filepath.Dir(root), "linked-agent")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	_, err := service.DeleteWorkspace(context.Background(), DeleteWorkspaceInput{AgentID: "linked-agent"})
	if code := CodeOf(err); code != ErrorSymlinkRejected {
		t.Fatalf("error code = %q, want %q (err=%v)", code, ErrorSymlinkRejected, err)
	}
	if _, err := os.Stat(filepath.Join(outside, "precious.txt")); err != nil {
		t.Fatalf("symlink target was touched: %v", err)
	}
}

// The workspace root holds every organization's workspace. Removing it would
// wipe them all at once.
func TestDeleteWorkspaceLogsBeforeRemoving(t *testing.T) {
	root := filepath.Join(t.TempDir(), "main")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatalf("create workspace: %v", err)
	}
	var logged []string
	service, err := NewService(filepath.Dir(root), func(format string, args ...any) {
		logged = append(logged, format)
	})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	if _, err := service.DeleteWorkspace(context.Background(), DeleteWorkspaceInput{AgentID: "main"}); err != nil {
		t.Fatalf("DeleteWorkspace: %v", err)
	}
	if len(logged) == 0 {
		t.Fatal("a workspace was removed without logging anything")
	}
}

// The workspace directory is never recreated, so a workspace the Gateway made
// private stays private.
func TestDeleteWorkspaceKeepsTheDirectoryMode(t *testing.T) {
	root, service := newWorkspace(t)
	if err := os.Chmod(root, 0o700); err != nil {
		t.Fatalf("chmod: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "AGENTS.md"), []byte("x"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if _, err := service.DeleteWorkspace(context.Background(), DeleteWorkspaceInput{AgentID: "main"}); err != nil {
		t.Fatalf("DeleteWorkspace: %v", err)
	}

	info, err := os.Stat(root)
	if err != nil {
		t.Fatalf("workspace directory was removed: %v", err)
	}
	if info.Mode().Perm() != 0o700 {
		t.Fatalf("mode = %v, want 0700", info.Mode().Perm())
	}
}

// The Gateway reads a workspace with none of AGENTS/SOUL/IDENTITY/USER.md as
// brand new, and takes BOOTSTRAP.md as evidence one survived. Reclaiming must
// leave both kinds of file behind, or the organization cannot be provisioned
// again until the Gateway's 24-hour attestation expires.
func TestDeleteWorkspaceKeepsWhatTheGatewayLooksFor(t *testing.T) {
	root, service := newWorkspace(t)
	scaffold := []string{"AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md", "BOOTSTRAP.md", "HEARTBEAT.md", "TOOLS.md", "openclaw-workspace-state.json"}
	for _, name := range scaffold {
		if err := os.WriteFile(filepath.Join(root, name), []byte(name), 0o600); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	writeSkill(t, root, "cpu-report", map[string]string{"SKILL.md": "# cpu"})
	if err := os.MkdirAll(filepath.Join(root, "memory"), 0o755); err != nil {
		t.Fatalf("create memory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "MEMORY.md"), []byte("remembered"), 0o600); err != nil {
		t.Fatalf("write MEMORY.md: %v", err)
	}

	if _, err := service.DeleteWorkspace(context.Background(), DeleteWorkspaceInput{AgentID: "main"}); err != nil {
		t.Fatalf("DeleteWorkspace: %v", err)
	}

	for _, name := range scaffold {
		if _, err := os.Stat(filepath.Join(root, name)); err != nil {
			t.Fatalf("%s was removed: %v", name, err)
		}
	}
	// Everything the organization accumulated is gone - that is what reclaiming
	// the workspace is for.
	for _, name := range []string{"skills", "memory", "MEMORY.md"} {
		if _, err := os.Stat(filepath.Join(root, name)); !os.IsNotExist(err) {
			t.Fatalf("%s survived: %v", name, err)
		}
	}
}
