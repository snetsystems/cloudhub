#!/usr/bin/env bash
# set-networkpolicy-port.sh — Set the demo NetworkPolicy ingress port (fault injection).
#
# Applies ONLY the `allow-frontend-to-backend` NetworkPolicy in the
# `network-repair-demo` namespace, with the ingress port you choose, through the
# CloudHub Kubernetes proxy (server-side apply). Use this to break traffic
# (port 8081) and then repair it from the CloudHub AI chat.
#
# Usage:
#   ./integration/set-networkpolicy-port.sh          # sets port 8081 (break)
#   ./integration/set-networkpolicy-port.sh 8080      # sets port 8080 (restore)
#
# CloudHub target and credentials are read from test.env (same keys as
# run-demo.sh): CLOUDHUB_URL, CLOUDHUB_USERNAME, CLOUDHUB_PASSWORD,
# CLOUDHUB_INSECURE_SKIP_VERIFY. Shell environment overrides test.env.
set -euo pipefail

PORT="${1:-8081}"
if ! [[ "${PORT}" =~ ^[0-9]+$ ]]; then
  echo "error: port must be a number (got '${PORT}')" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
MODULE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
REPOSITORY_ROOT="$(cd "${MODULE_ROOT}/../.." && pwd -P)"
ENV_FILE="${DEMO_ENV_FILE:-${REPOSITORY_ROOT}/test.env}"

NAMESPACE="network-repair-demo"
POLICY="allow-frontend-to-backend"

# Read a KEY=value from the env file as data (no sourcing/execution).
read_env_value() {
  local key="$1"
  awk -v wanted="${key}" '
    /^[[:space:]]*(#|$)/ { next }
    { line=$0; sub(/\r$/,"",line); eq=index(line,"=");
      if (eq==0) next;
      name=substr(line,1,eq-1); gsub(/^[[:space:]]+|[[:space:]]+$/,"",name);
      if (name==wanted) { v=substr(line,eq+1); sub(/^[[:space:]]+/,"",v); found=v } }
    END { if (found!="") print found }' "${ENV_FILE}"
}
load_env_key() {
  local key="$1" value
  if [[ -n "${!key:-}" || ! -r "${ENV_FILE}" ]]; then return; fi
  value="$(read_env_value "${key}")"
  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then value="${value:1:${#value}-2}";
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then value="${value:1:${#value}-2}"; fi
  if [[ -n "${value}" ]]; then printf -v "${key}" '%s' "${value}"; export "${key}"; fi
}

load_env_key CLOUDHUB_URL
load_env_key CLOUDHUB_USERNAME
load_env_key CLOUDHUB_PASSWORD
load_env_key CLOUDHUB_INSECURE_SKIP_VERIFY

BASE_URL="${CLOUDHUB_BASE_URL:-${CLOUDHUB_URL:-}}"
: "${BASE_URL:?set CLOUDHUB_URL (or CLOUDHUB_BASE_URL) or put it in ${ENV_FILE}}"
: "${CLOUDHUB_USERNAME:?set CLOUDHUB_USERNAME or put it in ${ENV_FILE}}"
: "${CLOUDHUB_PASSWORD:?set CLOUDHUB_PASSWORD or put it in ${ENV_FILE}}"
BASE_URL="${BASE_URL%/}"

CURL_OPTS=(-sS)
if [[ "${CLOUDHUB_INSECURE_SKIP_VERIFY:-}" == "true" ]]; then CURL_OPTS+=(-k); fi

COOKIE_JAR="$(mktemp)"
trap 'rm -f "${COOKIE_JAR}"' EXIT

echo "CloudHub  : ${BASE_URL}"
echo "Namespace : ${NAMESPACE}"
echo "Policy    : ${POLICY}"
echo "Port      : ${PORT}"

# 1) Basic login (JSON {name,password}) -> session cookie.
login_code="$(curl "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' -c "${COOKIE_JAR}" \
  -X POST "${BASE_URL}/basic/login" -H 'Content-Type: application/json' \
  --data "$(printf '{"name":%s,"password":%s}' \
    "$(printf '%s' "${CLOUDHUB_USERNAME}" | sed 's/\\/\\\\/g;s/"/\\"/g;s/^/"/;s/$/"/')" \
    "$(printf '%s' "${CLOUDHUB_PASSWORD}" | sed 's/\\/\\\\/g;s/"/\\"/g;s/^/"/;s/$/"/')")")"
if [[ "${login_code}" != "200" ]]; then
  echo "error: login failed (HTTP ${login_code})" >&2; exit 1
fi
echo "login: OK"

# 2) Server-side apply the NetworkPolicy with the chosen port.
API_PATH="/apis/networking.k8s.io/v1/namespaces/${NAMESPACE}/networkpolicies/${POLICY}"
ENDPOINT="${BASE_URL}/cloudhub/v1/kubernetes/proxy${API_PATH}?fieldManager=cloudhub-network-repair-demo&force=true"

read -r -d '' POLICY_YAML <<YAML || true
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${POLICY}
  namespace: ${NAMESPACE}
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: ${PORT}
YAML

apply_code="$(curl "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' -b "${COOKIE_JAR}" \
  -X PATCH "${ENDPOINT}" -H 'Content-Type: application/apply-patch+yaml' \
  --data-binary "${POLICY_YAML}")"
if [[ "${apply_code}" != "200" && "${apply_code}" != "201" ]]; then
  echo "error: apply failed (HTTP ${apply_code})" >&2; exit 1
fi

echo "apply: OK (HTTP ${apply_code}) — ${POLICY} ingress port is now ${PORT}"
