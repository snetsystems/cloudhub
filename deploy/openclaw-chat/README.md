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
`openclaw.json`. The agent denies every tool and takes no workspace access —
that isolation from the investigations agent is deliberate, so keep it.

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
