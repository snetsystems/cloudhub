import React, {useEffect, useMemo, useState} from 'react'
import {HubblePolicyRef, HubblePolicyResponse} from 'src/hubble/types'
import {getHubblePolicy} from 'src/hubble/apis'
import {
  PolicyRuleSummary,
  PolicySummary,
  summarizePolicy,
} from 'src/hubble/utils/summarizePolicy'

interface Props {
  cluster: string
  policy: HubblePolicyRef | null
  onClose: () => void
}

// PolicyModal fetches and renders one CiliumNetworkPolicy / NetworkPolicy /
// CiliumClusterwideNetworkPolicy spec by name+kind+namespace. The frontend
// always shows the policy ref header (Kind/Namespace/Name/Labels) so the
// operator can see "which policy" even when the K8s API is unreachable.
//
// When the backend returns 501 (no K8s endpoint configured), we fall back to
// rendering a kubectl command the operator can copy/paste manually.
const PolicyModal: React.FC<Props> = ({cluster, policy, onClose}) => {
  const [spec, setSpec] = useState<unknown>(null)
  const [apiPath, setApiPath] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [showRaw, setShowRaw] = useState<boolean>(false)
  const summary = useMemo<PolicySummary | null>(
    () => (spec ? summarizePolicy(spec) : null),
    [spec]
  )

  useEffect(() => {
    if (!policy || !policy.name) {
      setSpec(null)
      setApiPath('')
      setError('')
      return
    }
    if (!policy.kind) {
      setSpec(null)
      setApiPath('')
      setError(
        'Policy kind is unknown (no derived-from label from Hubble). Use kubectl directly.'
      )
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    setSpec(null)
    setApiPath('')
    getHubblePolicy(
      cluster,
      policy.kind,
      policy.name,
      policy.namespace || undefined
    )
      .then((resp: HubblePolicyResponse) => {
        if (cancelled) return
        setSpec(resp.spec)
        setApiPath(resp.apiPath)
      })
      .catch(err => {
        if (cancelled) return
        const status = err?.response?.status
        const body = err?.response?.data
        if (status === 501) {
          setError(
            'CloudHub Kubernetes integration is not configured (set --kubernetes=url:… and --kubernetes=token:… on startup) — see the kubectl snippet below to view the policy manually.'
          )
        } else if (typeof body === 'string') {
          setError(body)
        } else if (body?.message) {
          setError(body.message)
        } else {
          setError(err?.message || 'Failed to load policy.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cluster, policy])

  if (!policy) return null

  const kubectlCommand = buildKubectlCommand(policy)

  return (
    <div className="hubble-flow-modal-backdrop" onClick={onClose}>
      <div
        className="hubble-flow-modal hubble-policy-modal"
        role="dialog"
        aria-label="Policy details"
        onClick={e => e.stopPropagation()}
      >
        <div className="hubble-flow-modal-header">
          <h3 className="hubble-flow-modal-title">Policy</h3>
          <button
            className="hubble-flow-modal-close"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
        <div className="hubble-flow-modal-body">
          <Field label="Kind" value={policy.kind || 'Unknown'} mono />
          {policy.namespace && (
            <Field label="Namespace" value={policy.namespace} mono />
          )}
          <Field label="Name" value={policy.name} mono />
          {policy.revision !== undefined && policy.revision > 0 && (
            <Field
              label="Revision"
              value={String(policy.revision)}
              mono
            />
          )}
          {policy.labels && policy.labels.length > 0 && (
            <div className="hubble-flow-modal-field">
              <div className="hubble-flow-modal-field-label">Labels</div>
              <div className="hubble-flow-modal-labels">
                {policy.labels.map((l, i) => (
                  <span
                    key={i}
                    className="hubble-flow-modal-label-chip"
                    title={l}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="hubble-policy-modal-status">Loading policy spec…</div>
          )}
          {!loading && error && (
            <>
              <div className="hubble-policy-modal-status is-error">{error}</div>
              <div className="hubble-flow-modal-field">
                <div className="hubble-flow-modal-field-label">
                  kubectl command
                </div>
                <pre className="hubble-policy-modal-snippet">
                  {kubectlCommand}
                </pre>
              </div>
            </>
          )}
          {!loading && !error && spec !== null && (
            <div className="hubble-policy-modal-spec">
              {summary && !summary.unknown && (
                <PolicySummaryView summary={summary} />
              )}
              <div className="hubble-policy-modal-raw-toggle-row">
                <button
                  type="button"
                  className="hubble-policy-modal-raw-toggle"
                  onClick={() => setShowRaw(v => !v)}
                >
                  {showRaw ? '▼ Hide raw spec' : '▶ Show raw spec'}
                </button>
                <span className="hubble-policy-modal-api-path" title={apiPath}>
                  {apiPath}
                </span>
              </div>
              {showRaw && (
                <pre className="hubble-policy-modal-json">
                  {JSON.stringify(spec, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const Field: React.FC<{label: string; value: string; mono?: boolean}> = ({
  label,
  value,
  mono,
}) => (
  <div className="hubble-flow-modal-field">
    <div className="hubble-flow-modal-field-label">{label}</div>
    <div
      className={`hubble-flow-modal-field-value ${mono ? 'is-mono' : ''}`}
    >
      {value}
    </div>
  </div>
)

const buildKubectlCommand = (p: HubblePolicyRef): string => {
  const resource = kindToResource(p.kind)
  if (!resource) {
    return `# unknown kind: ${p.kind || '(empty)'}\nkubectl get <resource> ${p.name} -o yaml`
  }
  if (p.namespace) {
    return `kubectl get ${resource} ${p.name} -n ${p.namespace} -o yaml`
  }
  return `kubectl get ${resource} ${p.name} -o yaml`
}

const PolicySummaryView: React.FC<{summary: PolicySummary}> = ({summary}) => (
  <div className="hubble-policy-summary">
    {summary.description && (
      <div className="hubble-policy-summary-desc">{summary.description}</div>
    )}
    <div className="hubble-policy-summary-applies">
      <span className="hubble-policy-summary-key">Applies to</span>
      <span className="hubble-policy-summary-value">{summary.appliesTo}</span>
    </div>
    {summary.rules.length === 0 ? (
      <div className="hubble-policy-summary-empty">
        (no rules — this policy has no ingress/egress entries)
      </div>
    ) : (
      <div className="hubble-policy-summary-rules">
        {summary.rules.map((r, i) => (
          <RuleRow key={i} rule={r} />
        ))}
      </div>
    )}
  </div>
)

const RuleRow: React.FC<{rule: PolicyRuleSummary}> = ({rule}) => {
  const fromOrTo = rule.direction === 'Ingress' ? 'From' : 'To'
  return (
    <div
      className={`hubble-policy-summary-rule action--${rule.action.toLowerCase()}`}
    >
      <div className="hubble-policy-summary-rule-header">
        <span
          className={`hubble-policy-summary-badge action-${rule.action.toLowerCase()}`}
        >
          {rule.action}
        </span>
        <span className="hubble-policy-summary-badge direction">
          {rule.direction}
        </span>
      </div>
      <div className="hubble-policy-summary-rule-body">
        {rule.peers.length > 0 && (
          <div className="hubble-policy-summary-line">
            <span className="hubble-policy-summary-key">{fromOrTo}</span>
            <div className="hubble-policy-summary-chips">
              {rule.peers.map((p, i) => (
                <span key={i} className="hubble-policy-summary-chip">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
        {rule.ports.length > 0 && (
          <div className="hubble-policy-summary-line">
            <span className="hubble-policy-summary-key">Ports</span>
            <div className="hubble-policy-summary-chips">
              {rule.ports.map((p, i) => (
                <span
                  key={i}
                  className="hubble-policy-summary-chip is-port"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
        {rule.l7.length > 0 && (
          <div className="hubble-policy-summary-line">
            <span className="hubble-policy-summary-key">L7</span>
            <div className="hubble-policy-summary-chips">
              {rule.l7.map((p, i) => (
                <span key={i} className="hubble-policy-summary-chip is-l7">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const kindToResource = (kind?: string): string => {
  switch (kind) {
    case 'CiliumNetworkPolicy':
      return 'ciliumnetworkpolicy'
    case 'CiliumClusterwideNetworkPolicy':
      return 'ciliumclusterwidenetworkpolicy'
    case 'NetworkPolicy':
      return 'networkpolicy'
    default:
      return ''
  }
}

export default PolicyModal
