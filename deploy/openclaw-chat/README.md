# OpenClaw chat: local Gateway setup

Everything CloudHub's chat relay needs from an OpenClaw Gateway that is not
already in the Go code. Run through this once per machine.

CloudHub only reaches the Gateway over `--openclaw-gateway-url`, so the Gateway
itself — its image, its `openclaw.json`, its Ollama backend — stays outside this
repository. What lives here is the part CloudHub dictates: the agent it addresses
by ID, that agent's workspace, and the device credentials it authenticates with.

| File | What it is |
| --- | --- |
| `openclaw.agent.json` | The `cloudhub-chat` agent, to merge into the Gateway's `openclaw.json` |
| `agents/cloudhub-chat/` | That agent's workspace, mounted into the Gateway |
| `provision-device.sh` | Pairs this checkout as an operator device |

## 1. Register the agent

CloudHub generates every session key as
`agent:cloudhub-chat:cloudhub:<org>:<user>:<id>`, so the Gateway must have an
agent with exactly that ID. Without it, sending a message fails.

Merge `openclaw.agent.json` into the `agents` array of your Gateway's
`openclaw.json`.

The agent carries a deliberately small read-only toolset — `read` plus the
session-reading tools — so the chat page has real tool activity to display.
`tools.allow` is an exclusive allowlist: nothing outside it is callable, and
writes, `exec`, the browser, and network fetches stay denied on top of that.
Widen the allowlist only knowing that every allowed tool runs on the Gateway
host and its output is relayed to the browser.

## 2. Mount the workspace

The `workspace` path in the fragment is the path *inside* the container:

```yaml
volumes:
  - type: bind
    source: "<abs path>/deploy/openclaw-chat"
    target: "/opt/cloudhub-openclaw"
```

The agent runtime writes session state under this mount, so it has to be
writable. If you already mount the OpenClaw plugin checkout at
`/opt/cloudhub-openclaw`, copy `agents/cloudhub-chat/` in there instead of
adding a second mount.

Restart the Gateway after both steps.

## 3. Create the device credentials

```bash
OPENCLAW_GATEWAY_TOKEN=<gateway admin token> \
GATEWAY_CONTAINER=<container name from docker ps> \
  ./deploy/openclaw-chat/provision-device.sh
```

This writes `.secrets/openclaw-device/private.key` and `device.token` at the
repository root. They are secrets and are never committed — **add `.secrets/` to
your `.gitignore` before running this**, or the private key sits in the working
tree one `git add -A` away from the remote.

The script runs the provisioner inside the Gateway container's network
namespace, because the Gateway only auto-approves pairing from a loopback peer.
Running it from the host lands on exit code 3, `pending-approval`.

Exit codes: `0` provisioned or already provisioned, `1` failed, `2` usage error,
`3` pending operator approval. It prints the device ID (a SHA-256 of the public
key) and the status, never a secret.

## 4. Start CloudHub

Point CloudHub at the Gateway's **host** port — not the in-container port the
provisioner used:

```
--openclaw-gateway-url=ws://127.0.0.1:<host port>
--openclaw-device-private-key-file=<repo>/.secrets/openclaw-device/private.key
--openclaw-device-token-file=<repo>/.secrets/openclaw-device/device.token
```

`--openclaw-agent-id` picks the agent new sessions bind to, and defaults to
`cloudhub-chat` — the agent registered above. Pass it empty to bind whatever the
Gateway calls its default instead, which is how a stock OpenClaw install works
without step 1 at all. Be aware the Gateway's default is the agent flagged
`default`, else the *first* one configured, so on a Gateway with several agents
it is worth checking which one that is rather than assuming `main`.

The agent is resolved once, when a session is created, and stored with it: an
existing conversation keeps its agent even if this flag changes later, because
the agent is part of the Gateway session key that holds its history.

`OPENCLAW_GATEWAY_URL`, `OPENCLAW_DEVICE_PRIVATE_KEY_FILE`, and
`OPENCLAW_DEVICE_TOKEN_FILE` work too. Startup should log:

```
PostgreSQL OpenClawSessionStore initialized
OpenClaw gateway connected as a paired operator device  device_id=...
```

Leave `--openclaw-gateway-url` unset and CloudHub starts with the integration
off: listing and creating sessions still work, while history, send, and the
event socket return `503`.

## Also required, outside this directory

- **The database table.** Apply
  `backend/rdb/pgsql/migrations/006_create_openclaw_sessions.sql` yourself;
  this branch has no migration runner.
- **`go.sum`.** It is not tracked, so a fresh clone needs `go mod download`
  before `go build ./...`.

The endpoints are documented in `/docs` (Redoc) once the server is up. Note that
`swagger_gen.go` is generated and untracked — run
`PATH="$HOME/go/bin:$PATH" make backend/server/swagger_gen.go` to serve the
current spec.
