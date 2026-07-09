import React from 'react'

interface Props {
  wsConnected: boolean
  paused: boolean
  onTogglePause: () => void
}

const StatusBar: React.FC<Props> = ({wsConnected, paused, onTogglePause}) => {
  const label = !wsConnected
    ? 'Reconnecting…'
    : paused
    ? 'Paused'
    : 'Live'

  const tone = !wsConnected ? 'is-bad' : paused ? 'is-paused' : 'is-ok'

  const title = paused
    ? '실시간 갱신이 일시 정지됨 — 클릭하여 재개'
    : '실시간 갱신 중 — 클릭하여 일시 정지'

  return (
    <div className="hubble-status-bar">
      <button
        type="button"
        className={`hubble-status-pill hubble-status-pill-toggle ${tone}`}
        onClick={onTogglePause}
        title={title}
        aria-pressed={paused}
      >
        <span className="hubble-status-dot" />
        {label}
      </button>
    </div>
  )
}

export default StatusBar
