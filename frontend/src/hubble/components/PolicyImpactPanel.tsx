import React from 'react'
import {
  PolicyImpactBaseline,
  PolicyImpactComparison,
  PolicyImpactEntry,
} from 'src/hubble/types'

interface Props {
  baseline: PolicyImpactBaseline | null
  comparison: PolicyImpactComparison | null
  currentFlowCount: number
  onCapture: () => void
  onClear: () => void
}

const PolicyImpactPanel: React.FC<Props> = ({
  baseline,
  comparison,
  currentFlowCount,
  onCapture,
  onClear,
}) => (
  <div className="hubble-panel hubble-policy-impact-panel">
    <div className="hubble-panel-header">
      <h4 className="hubble-panel-title">Policy impact</h4>
      {baseline && (
        <button
          type="button"
          className="hubble-panel-close"
          onClick={onClear}
          title="Clear baseline"
        >
          ×
        </button>
      )}
    </div>
    <div className="hubble-policy-actions">
      <button
        type="button"
        className="hubble-policy-capture"
        onClick={onCapture}
        disabled={currentFlowCount === 0}
      >
        {baseline ? 'Recapture baseline' : 'Capture baseline'}
      </button>
      <span className="hubble-policy-flow-count">{currentFlowCount} flows</span>
    </div>
    {!baseline && (
      <div className="hubble-panel-empty">
        Capture before applying a NetworkPolicy, then replay traffic.
      </div>
    )}
    {baseline && (
      <>
        <div className="hubble-policy-meta">
          Baseline {formatTime(baseline.capturedAt)} · {baseline.flowCount}{' '}
          flows · {baseline.summaries.length} dependencies
        </div>
        {comparison && !comparison.contextMatches && (
          <div className="hubble-policy-warning">
            Current cluster, namespace, or filters differ from the baseline.
            Capture again to compare this view.
          </div>
        )}
        {comparison && comparison.contextMatches && (
          <div className="hubble-policy-summary-grid">
            <ImpactStat
              label="Newly denied"
              value={comparison.newlyDenied.length}
              tone="bad"
            />
            <ImpactStat
              label="Recovered"
              value={comparison.recovered.length}
              tone="good"
            />
            <ImpactStat
              label="Still denied"
              value={comparison.stillDenied.length}
            />
            <ImpactStat label="New" value={comparison.newConnections.length} />
          </div>
        )}
        {comparison && comparison.contextMatches && (
          <div className="hubble-policy-sections">
            <ImpactSection
              title="Newly denied"
              entries={comparison.newlyDenied}
              empty="No newly denied dependencies"
            />
            <ImpactSection
              title="Recovered"
              entries={comparison.recovered}
              empty="No recovered dependencies"
            />
            <ImpactSection
              title="New connections"
              entries={comparison.newConnections}
              empty="No new dependencies"
            />
          </div>
        )}
      </>
    )}
  </div>
)

const ImpactStat: React.FC<{
  label: string
  value: number
  tone?: 'good' | 'bad'
}> = ({label, value, tone}) => (
  <div className={`hubble-policy-stat ${tone ? `is-${tone}` : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const ImpactSection: React.FC<{
  title: string
  entries: PolicyImpactEntry[]
  empty: string
}> = ({title, entries, empty}) => (
  <div className="hubble-policy-section">
    <div className="hubble-detail-subtitle">{title}</div>
    {entries.length === 0 && <div className="hubble-panel-empty">{empty}</div>}
    {entries.slice(0, 5).map(entry => (
      <div className="hubble-policy-entry" key={entry.key}>
        <div className="hubble-policy-entry-main">
          <span title={entry.srcLabel}>{entry.srcLabel}</span>
          <span className="hubble-policy-arrow">→</span>
          <span title={entry.dstLabel}>{entry.dstLabel}</span>
        </div>
        <div className="hubble-policy-entry-meta">
          {entry.port ? `${entry.port} ` : ''}
          {entry.protocol || ''}
          {entry.l7 ? ` · ${entry.l7}` : ''}
        </div>
        <div className="hubble-policy-entry-verdicts">
          {entry.beforeVerdict || '—'} → {entry.afterVerdict || '—'}
          {formatDropReasons(entry.dropReasons)}
        </div>
      </div>
    ))}
    {entries.length > 5 && (
      <div className="hubble-policy-more">+{entries.length - 5} more</div>
    )}
  </div>
)

const formatDropReasons = (reasons: Record<string, number>): string => {
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]
  if (!top) return ''
  return ` · ${top[0]} (${top[1]})`
}

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default PolicyImpactPanel
