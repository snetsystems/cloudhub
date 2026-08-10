#!/usr/bin/env bash
# Provisions this CloudHub checkout as a paired OpenClaw operator device: it
# generates an Ed25519 device key, pairs with the Gateway, and writes the device
# token the Gateway issues. Run it once, before starting CloudHub with the
# --openclaw-device-*-file flags. Re-running is a no-op once both files exist.
#
# It runs the provisioner inside the Gateway container's network namespace so
# OpenClaw sees a loopback peer. A loopback connect with no browser Origin
# header and a "not-paired" reason is auto-approved silently by the Gateway
# (shouldAllowSilentLocalPairing); there is no config key to enable this, and
# gateway.nodes.pairing.autoApproveCidrs applies only to node-role pairing.
# Running this from the host instead lands on exit code 3, pending approval.
#
# The Gateway's own administrator token is the provisioning-only bootstrap
# token; it is never used for runtime reconnects. Read it from the live
# Gateway deployment's .env. It is passed to `docker run` via a bare `-e VAR`
# (no `=value`), so the value is inherited from this shell's environment and
# never appears in a docker command line or a process listing.
#
# Usage:
#   OPENCLAW_GATEWAY_TOKEN=<gateway admin token> \
#   GATEWAY_CONTAINER=<container name> \
#     ./deploy/openclaw-chat/provision-device.sh
#
# Exit codes: 0 provisioned or already provisioned, 1 failed, 2 usage error,
# 3 registered but pending operator approval.
set -euo pipefail

# Container name of the running Gateway (docker ps), and the port it listens on
# *inside* that container — not the host-published port.
GATEWAY_CONTAINER="${GATEWAY_CONTAINER:-openclaw-gateway}"
GATEWAY_URL="${GATEWAY_URL:-ws://127.0.0.1:18789}"
PROVISION_IMAGE="${PROVISION_IMAGE:-alpine:3.20}"

if [[ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]]; then
  echo "error: OPENCLAW_GATEWAY_TOKEN is not set (the Gateway's administrator token)" >&2
  exit 1
fi

if ! docker inspect "${GATEWAY_CONTAINER}" >/dev/null 2>&1; then
  echo "error: no such container: ${GATEWAY_CONTAINER}" >&2
  echo "       set GATEWAY_CONTAINER to the running Gateway (docker ps)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
CRED_DIR="${ROOT}/.secrets/openclaw-device"
mkdir -p "${CRED_DIR}"
chmod 700 "${CRED_DIR}"

BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "${BUILD_DIR}"' EXIT
BINARY="${BUILD_DIR}/cloudhub-openclaw-provision"

echo "building provisioner..."
(cd "${ROOT}/backend" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -o "${BINARY}" ./cmd/cloudhub-openclaw-provision)

# Provisioning-only bootstrap token; never used for runtime reconnects.
export OPENCLAW_GATEWAY_BOOTSTRAP_TOKEN="${OPENCLAW_GATEWAY_TOKEN}"

echo "provisioning against ${GATEWAY_URL} inside ${GATEWAY_CONTAINER}'s network namespace..."
rc=0
docker run --rm \
  --network "container:${GATEWAY_CONTAINER}" \
  --user "$(id -u):$(id -g)" \
  -e OPENCLAW_GATEWAY_URL="${GATEWAY_URL}" \
  -e OPENCLAW_GATEWAY_BOOTSTRAP_TOKEN \
  -e OPENCLAW_DEVICE_PRIVATE_KEY_FILE=/creds/private.key \
  -e OPENCLAW_DEVICE_TOKEN_FILE=/creds/device.token \
  -v "${BINARY}:/cloudhub-openclaw-provision:ro" \
  -v "${CRED_DIR}:/creds" \
  --entrypoint /cloudhub-openclaw-provision \
  "${PROVISION_IMAGE}" || rc=$?

echo "private key:  ${CRED_DIR}/private.key"
echo "device token: ${CRED_DIR}/device.token"
exit "${rc}"
