#!/usr/bin/env bash
# Runs the API-only NetworkPolicy recovery demo from the 237 development host.
# The env file is parsed as data, not sourced, so its contents cannot execute.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
MODULE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
REPOSITORY_ROOT="$(cd "${MODULE_ROOT}/../.." && pwd -P)"
ENV_FILE="${DEMO_ENV_FILE:-${REPOSITORY_ROOT}/test.env}"

read_env_value() {
  local key="$1"
  awk -v wanted="${key}" '
    /^[[:space:]]*(#|$)/ { next }
    {
      line = $0
      sub(/\r$/, "", line)
      equals = index(line, "=")
      if (equals == 0) { next }
      name = substr(line, 1, equals - 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", name)
      if (name == wanted) {
        value = substr(line, equals + 1)
        sub(/^[[:space:]]+/, "", value)
        found = value
      }
    }
    END { if (found != "") print found }
  ' "${ENV_FILE}"
}

load_env_key() {
  local key="$1" value
  if [[ -n "${!key:-}" || ! -r "${ENV_FILE}" ]]; then
    return
  fi
  value="$(read_env_value "${key}")"
  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  if [[ -n "${value}" ]]; then
    printf -v "${key}" '%s' "${value}"
    export "${key}"
  fi
}

load_env_key CLOUDHUB_URL
load_env_key CLOUDHUB_USERNAME
load_env_key CLOUDHUB_PASSWORD
load_env_key CLOUDHUB_INSECURE_SKIP_VERIFY
load_env_key MCP_BASE_URL

CLOUDHUB_BASE_URL="${CLOUDHUB_BASE_URL:-${CLOUDHUB_URL:-}}"
MCP_BASE_URL="${MCP_BASE_URL:-http://127.0.0.1:8080}"
HUBBLE_CLUSTER="${HUBBLE_CLUSTER:-dev}"
DEMO_NAMESPACE="${DEMO_NAMESPACE:-network-repair-demo}"
RUN_DEMO_E2E=1

if [[ -z "${CLOUDHUB_BASE_URL}" ]]; then
  echo "error: set CLOUDHUB_BASE_URL or CLOUDHUB_URL, or provide it in ${ENV_FILE}" >&2
  exit 2
fi
if [[ -z "${CLOUDHUB_AUTHORIZATION:-}" && ( -z "${CLOUDHUB_USERNAME:-}" || -z "${CLOUDHUB_PASSWORD:-}" ) ]]; then
  echo "error: set CLOUDHUB_AUTHORIZATION or CloudHub username and password" >&2
  exit 2
fi

export CLOUDHUB_BASE_URL MCP_BASE_URL HUBBLE_CLUSTER DEMO_NAMESPACE RUN_DEMO_E2E

cd "${MODULE_ROOT}"
exec go test -count=1 -v ./integration -run '^TestNetworkPolicyRecoveryDemo$'
