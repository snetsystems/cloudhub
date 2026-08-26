# skill-admin MCP server

Deletes OpenClaw workspace skill directories on behalf of CloudHub.

## Why this exists

OpenClaw exposes **no API or CLI that removes an applied skill**. That is
deliberate — the Skill Workshop design principle is "Apply is the only live
write", and the uninstall feature request
([openclaw#14264](https://github.com/openclaw/openclaw/issues/14264)) was closed
as not planned.

The alternatives were worse:

- `skills.entries.<key>.enabled = false` is **global**. One organization
  retiring `cpu-report` disables another organization's skill of the same name,
  and a skill created afterwards under that name is born disabled.
- `agents.list[].skills` allowlisting scopes correctly but has to enumerate
  every bundled skill to keep it, and has to be walked for every agent.

Deleting the directory is the only option that is workspace-scoped, immediate,
and reclaims disk. This server is what makes it reachable.

## How CloudHub calls it

CloudHub speaks to this server **directly**. The Gateway is not in the path.

```
CloudHub ──(MCP over HTTP, bearer token)──> skill-admin ──> <workspace>/skills/<name>/ removed
```

Routing through the Gateway's `tools.invoke` was tried first and does not work.
MCP tools only enter an agent's tool set once that agent's runtime has connected
the MCP transport, which happens on an agent turn; before that the Gateway
answers `Tool not available` and `tools.effective` reports
`mcp-not-yet-connected`. Verified on 2026.7.1: a core tool invoked on the same
agent, in the same request shape, reached its handler while this tool returned
404. Tying retirement to "an agent must have run a turn recently" would make it
start failing after a Gateway restart.

Do **not** register this server in the Gateway's `mcp.servers`. Leaving it
unregistered is what guarantees no agent can reach a tool that deletes files —
only CloudHub, which holds the token.

## The tools

| Name | Input | Effect |
|---|---|---|
| `delete_workspace_skill` | `agentId`, `skillName` | removes `<root>/<agentId>/skills/<skillName>/` |
| `delete_agent_workspace` | `agentId` | strips `<root>/<agentId>/` back to its scaffold files |
| `copy_workspace_skills` | `sourceAgentId`, `targetAgentId` | copies each `skills/<name>/` the target does not already have |

All three are idempotent and closed-world. The two deletes are annotated
destructive; the copy is not, because it never overwrites - a name the target
already has is skipped.

`delete_agent_workspace` reclaims a deleted organization's workspace. The
Gateway's `agents.delete` removes the agent record but leaves its files, and
its RPC has no option to change that.

It leaves the scaffold behind on purpose: `AGENTS.md`, `SOUL.md`,
`IDENTITY.md`, `USER.md`, `BOOTSTRAP.md`, `HEARTBEAT.md`, `TOOLS.md` and
`openclaw-workspace-state.json`. The Gateway records that it initialized a
workspace, in state kept outside the directory, and for 24 hours afterwards it
refuses to create an agent whose workspace has since gone
(`WorkspaceVanishedError`, "refusing to reseed over a recently attested
workspace"). Two of its checks decide this: a workspace holding none of
`AGENTS`/`SOUL`/`IDENTITY`/`USER.md` reads as brand new, and `BOOTSTRAP.md` is
what it accepts as evidence the workspace survived. Stripping the directory
bare - or removing it - satisfies neither, and would keep the same
organization from being provisioned again for a day, which is exactly the
recovery the soft-deleted mapping exists to allow.

Everything of size is outside that set - skills, memory, whatever the agent
wrote - so the disk is still reclaimed. An agent name is derived from the
organization id, so a name only ever belongs to one organization: the
instructions left behind can only be read again by whoever wrote them.

`copy_workspace_skills` gives a newly provisioned organization its baseline
skills. They are copied rather than published because the Gateway's
`skills.proposals.*` API caps a skill description at 160 bytes
(`MAX_SKILL_PROPOSAL_DESCRIPTION_BYTES`), while a skill placed in a workspace
as files is read by a path with no such cap - which is how the Gateway's own
operational skills, several hundred bytes of description each, exist at all.

Deletion cannot be undone, so the input is checked rather than trusted:

1. `agentId` must be a plain directory name (`^[a-z][a-z0-9_-]*$`), which rules
   out `.`, `..` and separators. It is resolved under the workspace root and
   nowhere else.
2. `skillName` must match the same expression CloudHub applies when the skill
   is authored.
3. The resolved target must sit directly under its parent — the workspace root
   for a workspace, the `skills/` root for a skill.
4. A symlink is refused rather than followed, and a non-directory is refused.
5. Neither the workspace root nor a `skills/` root can itself be the target.
6. What is about to be removed is logged first.

An absent target is a **success**: deletion is retried, and an organization
that never used OpenClaw has no workspace to reclaim.

## Configuration

| Variable | Meaning |
|---|---|
| `SKILL_ADMIN_WORKSPACE_ROOT` | Absolute directory agent workspaces live under. Required. |
| `MCP_SERVER_AUTH_TOKEN` | Bearer token CloudHub must present. Required. |
| `MCP_LISTEN_ADDR` | Listen address, default `:8080`. |

An agent's workspace is `<SKILL_ADMIN_WORKSPACE_ROOT>/<agentId>`, matching how
CloudHub provisions them. A per-agent allowlist is not workable: CloudHub
creates an organization's agent at runtime and cannot rewrite this server's
environment to add it. Containment is enforced per call instead, and mounting
only this root keeps anything outside it out of reach.

`SKILL_ADMIN_WORKSPACE_ROOT` is this container's own view of that directory,
which is not the value CloudHub's `--openclaw-workspace-root` takes. That flag
is read by the Gateway, whose `agents.create` creates the directory, so it must
be the path *the Gateway process* sees. On the 237 PoC:

| Setting | Read by | Value |
|---|---|---|
| `--openclaw-workspace-root` | Gateway | `/home/node/.openclaw/cloudhub-openclaw/0.1.0/agents` |
| `SKILL_ADMIN_WORKSPACE_ROOT` | this server | `/workspaces` (the same host directory, mounted) |

Giving the Gateway a host path instead fails with
`EACCES: permission denied, mkdir '/home/...'`.

Three deployment details that are easy to miss:

- **Run as the Gateway's uid.** Agent workspaces are mode `0700` and owned by
  the Gateway user (uid 1000 in the official image), so the default
  unprivileged user in this image cannot remove anything inside them. The
  compose file sets `user:` accordingly.
- **CloudHub must be able to reach this server.** It runs on the Gateway host, so a
  remote CloudHub needs a route to it (one more forwarded port beside the
  Gateway's own).

## Building for another architecture

The Gateway host is not necessarily the machine you build on — a Jetson is
`aarch64`. There is no published image for this server, so it has to be built,
but it does not have to be built on the target:

```bash
docker buildx build --platform linux/arm64 -t skill-admin-mcp:0.1 --load .
docker save skill-admin-mcp:0.1 | ssh <host> docker load
```

## Development

```bash
go test ./...
docker compose up --build
```
