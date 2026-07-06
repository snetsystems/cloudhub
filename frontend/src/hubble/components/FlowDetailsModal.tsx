import React, {useState} from 'react'
import {HubbleFlowRecord, HubblePolicyRef} from 'src/hubble/types'
import PolicyModal from 'src/hubble/components/PolicyModal'

interface Props {
  flow: HubbleFlowRecord | null
  cluster?: string
  onClose: () => void
}

// FlowDetailsModal shows the full per-flow detail set in the same shape as
// Hubble UI's "Flow Details" panel — full timestamp, traffic direction,
// observation point, identity numbers, raw label list, IPs/ports, TCP flags,
// L7 signature, drop reason.
const FlowDetailsModal: React.FC<Props> = ({flow, cluster, onClose}) => {
  const [selectedPolicy, setSelectedPolicy] = useState<HubblePolicyRef | null>(
    null
  )
  if (!flow) return null

  return (
    <div className="hubble-flow-modal-backdrop" onClick={onClose}>
      <div
        className="hubble-flow-modal hubble-flow-details-modal"
        role="dialog"
        aria-label="Flow Details"
        onClick={e => e.stopPropagation()}
      >
        <div className="hubble-flow-modal-header">
          <h3 className="hubble-flow-modal-title">Flow Details</h3>
          <button
            className="hubble-flow-modal-close"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
        <div className="hubble-flow-modal-body">
          <Field label="Timestamp" value={flow.time} mono />
          <Field
            label="Verdict"
            value={flow.verdict}
            valueClass={verdictClass(flow.verdict)}
          />
          {flow.trafficDirection && (
            <Field
              label="Traffic direction"
              value={flow.trafficDirection.toLowerCase()}
            />
          )}
          {flow.observationPoint && (
            <ObservationPointField raw={flow.observationPoint} />
          )}
          {flow.tcpFlags && flow.tcpFlags.length > 0 && (
            <Field label="TCP flags" value={flow.tcpFlags.join(' ')} mono />
          )}

          <SectionHeader>Source</SectionHeader>
          {flow.srcPod && <Field label="Source pod" value={flow.srcPod} mono />}
          {flow.srcWorkload && (
            <Field label="Source workload" value={flow.srcWorkload} mono />
          )}
          {flow.srcNamespace && (
            <Field label="Source namespace" value={flow.srcNamespace} />
          )}
          {flow.srcIdentity !== undefined && flow.srcIdentity > 0 && (
            <Field label="Source identity" value={String(flow.srcIdentity)} mono />
          )}
          {flow.srcLabels && flow.srcLabels.length > 0 && (
            <LabelsField label="Source labels" labels={flow.srcLabels} />
          )}
          {flow.srcIp && <Field label="Source IP" value={flow.srcIp} mono />}
          {flow.srcPort ? (
            <Field
              label="Source port"
              value={`${flow.srcPort}${flow.protocol ? ` • ${flow.protocol}` : ''}`}
              mono
            />
          ) : null}

          <SectionHeader>Destination</SectionHeader>
          {flow.dstPod && (
            <Field label="Destination pod" value={flow.dstPod} mono />
          )}
          {flow.dstWorkload && (
            <Field label="Destination workload" value={flow.dstWorkload} mono />
          )}
          {flow.dstNamespace && (
            <Field label="Destination namespace" value={flow.dstNamespace} />
          )}
          {flow.dstIdentity !== undefined && flow.dstIdentity > 0 && (
            <Field
              label="Destination identity"
              value={String(flow.dstIdentity)}
              mono
            />
          )}
          {flow.dstLabels && flow.dstLabels.length > 0 && (
            <LabelsField label="Destination labels" labels={flow.dstLabels} />
          )}
          {flow.dstIp && <Field label="Destination IP" value={flow.dstIp} mono />}
          {flow.dstPort ? (
            <Field
              label="Destination port • protocol"
              value={`${flow.dstPort} • ${flow.protocol ?? 'TCP'}`}
              mono
            />
          ) : null}

          {(flow.l7 || flow.dropReason) && (
            <>
              <SectionHeader>L7 / Drop</SectionHeader>
              {flow.l7 && <Field label="L7 signature" value={flow.l7} mono />}
              {flow.dropReason && (
                <Field
                  label="Drop reason"
                  value={flow.dropReason}
                  valueClass="hubble-verdict-dropped"
                  mono
                />
              )}
            </>
          )}

          {((flow.deniedBy?.length ?? 0) > 0 ||
            (flow.allowedBy?.length ?? 0) > 0) && (
            <>
              <SectionHeader>Policies</SectionHeader>
              {(flow.deniedBy?.length ?? 0) > 0 && (
                <div className="hubble-flow-modal-field">
                  <div className="hubble-flow-modal-field-label hubble-verdict-dropped">
                    Denied by
                  </div>
                  <div className="hubble-flow-modal-policy-list">
                    {flow.deniedBy!.map((p, i) => (
                      <PolicyChip
                        key={i}
                        policy={p}
                        denied
                        clickable={!!cluster}
                        onClick={cluster ? setSelectedPolicy : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
              {(flow.allowedBy?.length ?? 0) > 0 && (
                <div className="hubble-flow-modal-field">
                  <div className="hubble-flow-modal-field-label">
                    Allowed by
                  </div>
                  <div className="hubble-flow-modal-policy-list">
                    {flow.allowedBy!.map((p, i) => (
                      <PolicyChip
                        key={i}
                        policy={p}
                        clickable={!!cluster}
                        onClick={cluster ? setSelectedPolicy : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {cluster && (
        <PolicyModal
          cluster={cluster}
          policy={selectedPolicy}
          onClose={() => setSelectedPolicy(null)}
        />
      )}
    </div>
  )
}

const PolicyChip: React.FC<{
  policy: HubblePolicyRef
  denied?: boolean
  clickable?: boolean
  onClick?: (p: HubblePolicyRef) => void
}> = ({policy, denied, clickable, onClick}) => {
  const label = policy.namespace
    ? `${policy.namespace}/${policy.name}`
    : policy.name
  const kindShort = policyKindShort(policy.kind)
  const className = [
    'hubble-policy-chip',
    denied ? 'hubble-policy-chip--denied' : '',
    clickable ? 'hubble-policy-chip--clickable' : '',
  ]
    .filter(Boolean)
    .join(' ')
  if (clickable && onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onClick(policy)}
        title={`${policy.kind || 'Unknown'} — 클릭해서 spec 보기`}
      >
        {kindShort && <span className="hubble-policy-kind-chip">{kindShort}</span>}
        {label}
      </button>
    )
  }
  return (
    <span className={className} title={policy.kind || 'Unknown'}>
      {kindShort && <span className="hubble-policy-kind-chip">{kindShort}</span>}
      {label}
    </span>
  )
}

const policyKindShort = (kind?: string): string => {
  switch (kind) {
    case 'CiliumNetworkPolicy':
      return 'CNP'
    case 'CiliumClusterwideNetworkPolicy':
      return 'CCNP'
    case 'NetworkPolicy':
      return 'NP'
    default:
      return ''
  }
}

const Field: React.FC<{
  label: string
  value: string
  mono?: boolean
  valueClass?: string
}> = ({label, value, mono, valueClass}) => (
  <div className="hubble-flow-modal-field">
    <div className="hubble-flow-modal-field-label">{label}</div>
    <div
      className={[
        'hubble-flow-modal-field-value',
        mono ? 'is-mono' : '',
        valueClass || '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {value}
    </div>
  </div>
)

const LabelsField: React.FC<{label: string; labels: string[]}> = ({
  label,
  labels,
}) => (
  <div className="hubble-flow-modal-field">
    <div className="hubble-flow-modal-field-label">{label}</div>
    <div className="hubble-flow-modal-labels">
      {labels.map((l, i) => (
        <span key={i} className="hubble-flow-modal-label-chip" title={l}>
          {l}
        </span>
      ))}
    </div>
  </div>
)

const SectionHeader: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div className="hubble-flow-modal-section-header">{children}</div>
)

const verdictClass = (verdict: string): string => {
  switch (verdict) {
    case 'FORWARDED':
      return 'hubble-verdict-forwarded'
    case 'DROPPED':
      return 'hubble-verdict-dropped'
    case 'ERROR':
    case 'AUDIT':
      return 'hubble-verdict-error'
    default:
      return ''
  }
}

const formatObservationPoint = (op: string): string => {
  // "TO_ENDPOINT" → "to-endpoint" to match Hubble UI conventions.
  return op.toLowerCase().replace(/_/g, '-')
}

// OBSERVATION_POINT_DESCRIPTIONS mirrors Cilium proto's TraceObservationPoint
// enum (api/v1/flow/flow.proto). Keep keys aligned with the upstream enum
// string so new values fall through to "" instead of mis-labeling.
const OBSERVATION_POINT_DESCRIPTIONS: Record<string, string> = {
  UNKNOWN_POINT:
    '관측점 미상 — datapath trace가 아닌 이벤트(drop/policy verdict 등)에서 표시됩니다.',
  TO_PROXY: 'L7 proxy로 송신되는 패킷',
  TO_HOST: '호스트 네임스페이스로 송신되는 패킷',
  TO_STACK: '호스트의 리눅스 커널 네트워크 스택으로 송신되는 패킷',
  TO_OVERLAY: '터널 디바이스(VXLAN 등)로 송신되는 패킷',
  TO_ENDPOINT: '컨테이너(endpoint)로 송신되는 패킷',
  FROM_ENDPOINT: '컨테이너에서 수신된 패킷',
  FROM_PROXY: 'L7 proxy에서 수신된 패킷',
  FROM_HOST: '호스트 네임스페이스에서 수신된 패킷',
  FROM_STACK: '리눅스 커널 네트워크 스택에서 수신된 패킷',
  FROM_OVERLAY: '터널 디바이스에서 수신된 패킷',
  FROM_NETWORK: '네이티브 네트워크 디바이스(NIC)에서 수신된 패킷',
  TO_NETWORK: '네이티브 네트워크 디바이스로 송신되는 패킷',
  FROM_CRYPTO: 'crypto 프로세스(복호화)에서 수신된 패킷',
  TO_CRYPTO: 'crypto 프로세스(암호화)로 송신되는 패킷',
}

const ObservationPointField: React.FC<{raw: string}> = ({raw}) => {
  const description = OBSERVATION_POINT_DESCRIPTIONS[raw] || ''
  return (
    <div className="hubble-flow-modal-field">
      <div className="hubble-flow-modal-field-label">Cilium event type</div>
      <div className="hubble-flow-modal-field-value">
        <span className="is-mono">{formatObservationPoint(raw)}</span>
        {description && (
          <span className="hubble-flow-modal-field-note"> — {description}</span>
        )}
      </div>
    </div>
  )
}

export default FlowDetailsModal
