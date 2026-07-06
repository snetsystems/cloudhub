import React, {useEffect, useState} from 'react'
import {HubbleSnapshot} from 'src/hubble/types'
import {formatWindowDuration} from 'src/hubble/utils/time'

interface Props {
  snapshot: HubbleSnapshot | null
  wsConnected: boolean
  onHelp?: () => void
}

// formatFlowAge renders the time since the most recent flow as a short label.
// Returns null if no flow has been observed yet. Used to distinguish "stream
// is healthy but quiet" from "stream is silent — something might be wrong".
const formatFlowAge = (lastFlowAt: string | undefined): string | null => {
  if (!lastFlowAt) return null
  const t = Date.parse(lastFlowAt)
  if (!Number.isFinite(t) || t <= 0) return null
  const ageMs = Date.now() - t
  if (ageMs < 0) return 'just now'
  const sec = Math.floor(ageMs / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

// flowAgeWarn determines whether the Last flow indicator should turn warning.
// 30s+ silence usually means the relay is up but no traffic is being captured.
const flowAgeWarn = (lastFlowAt: string | undefined): boolean => {
  if (!lastFlowAt) return false
  const t = Date.parse(lastFlowAt)
  if (!Number.isFinite(t) || t <= 0) return false
  return Date.now() - t > 30000
}

// StatusBar surfaces the signals the user needs to trust the data:
// relay connection, WS push freshness, window fill, edge cap, and the
// age of the last received flow (so quiet stream != broken stream).
const StatusBar: React.FC<Props> = ({snapshot, wsConnected, onHelp}) => {
  const status = snapshot?.status
  const snapWindow = snapshot?.window
  const relay = !!status?.relayConnected
  const filled = snapWindow ? Math.round(snapWindow.filled * 100) : 0

  // Re-render once per second so "Last flow Xs ago" stays current between
  // snapshot pushes (snapshots arrive every 2s, but seconds tick faster).
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = globalThis.setInterval(() => setTick(t => t + 1), 1000)
    return () => globalThis.clearInterval(id)
  }, [])

  const flowAge = formatFlowAge(status?.lastFlowAt)
  const flowAgeStale = flowAgeWarn(status?.lastFlowAt)
  const windowLabel = formatWindowDuration(snapWindow?.start, snapWindow?.end)

  return (
    <div className="hubble-status-bar">
      <Pill
        ok={relay}
        label={relay ? 'Relay connected' : 'Relay disconnected'}
      />
      <Pill
        ok={wsConnected}
        label={wsConnected ? 'Live' : 'Reconnecting…'}
      />
      <span
        className="hubble-status-item"
        title={
          windowLabel
            ? `최근 ${windowLabel} 동안 관측된 flow를 기준으로 노드/엣지를 표시합니다. 이 윈도우 안에 트래픽이 없는 pod/workload는 맵에 나타나지 않습니다. (CLOUDHUB_HUBBLE_WINDOW_DURATION으로 조정)`
            : '스냅샷 윈도우 — 관측 구간이 채워지면 100%가 됩니다.'
        }
      >
        Window&nbsp;
        <strong>{filled}%</strong>
        {windowLabel && (
          <span className="hubble-status-window-label">&nbsp;· {windowLabel}</span>
        )}
      </span>
      <span
        className="hubble-status-item"
        title="Hubble 관측 지점을 지난 flow '이벤트' 누적 수 — 패킷/바이트/트래픽 양이 아닙니다. 자잘한 통신(DNS 등)이 과대, 대용량 전송이 과소 대표될 수 있습니다."
      >
        Flow events&nbsp;
        <strong>{status?.flowsReceived ?? 0}</strong>
      </span>
      <span className="hubble-status-item">
        Edges&nbsp;
        <strong>{status?.edgesTracked ?? 0}</strong>
        {status?.edgeCapHit && (
          <span className="hubble-status-warning">&nbsp;(cap hit)</span>
        )}
      </span>
      <span
        className="hubble-status-item"
        title={
          flowAge
            ? '가장 최근에 수신된 flow의 경과 시간. 30초 이상이면 트래픽이 끊겼거나 필터가 너무 좁을 수 있음.'
            : 'Relay에서 flow를 한 건도 수신하지 못한 상태'
        }
      >
        Last flow&nbsp;
        <strong className={flowAgeStale ? 'hubble-status-warning' : undefined}>
          {flowAge ?? '—'}
        </strong>
      </span>
      {status?.error && (
        <span className="hubble-status-error">{status.error}</span>
      )}
      {onHelp && (
        <button
          type="button"
          className="hubble-side-tabs-help"
          title="헤더의 각 항목이 무엇인지 예시와 함께 단계별로 설명합니다"
          aria-label="Open header tutorial"
          onClick={onHelp}
        >
          ?
        </button>
      )}
    </div>
  )
}

const Pill: React.FC<{ok: boolean; label: string}> = ({ok, label}) => (
  <span
    className={`hubble-status-pill ${ok ? 'is-ok' : 'is-bad'}`}
    role="status"
  >
    <span className="hubble-status-dot" />
    {label}
  </span>
)

export default StatusBar
