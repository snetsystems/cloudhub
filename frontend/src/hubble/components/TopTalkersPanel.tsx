import React from 'react'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {HubbleSnapshot, HubbleTopTalker} from 'src/hubble/types'

interface Props {
  snapshot: HubbleSnapshot | null
}

const TopTalkersPanel: React.FC<Props> = ({snapshot}) => {
  const talkers = snapshot?.topTalkers ?? []

  return (
    <div className="hubble-panel hubble-top-talkers">
      <h4 className="hubble-panel-title">Top Talkers</h4>
      <FancyScrollbar autoHide={true} className="hubble-top-talkers-scroll">
        <div className="hubble-top-talkers-scroll-content">
        {talkers.length === 0 && (
          <div className="hubble-panel-empty">No traffic in window</div>
        )}
        <ul className="hubble-top-talkers-list">
          {talkers.map(t => (
            <TopTalkerRow key={`${t.src}|${t.dst}`} talker={t} />
          ))}
        </ul>
        </div>
      </FancyScrollbar>
    </div>
  )
}

const TopTalkerRow: React.FC<{talker: HubbleTopTalker}> = ({talker}) => (
  <li className="hubble-top-talkers-row">
    <span className="hubble-edge-label">
      <span className="hubble-edge-src">{shortName(talker.src)}</span>
      <span className="hubble-edge-arrow">→</span>
      <span className="hubble-edge-dst">{shortName(talker.dst)}</span>
    </span>
    <strong>{talker.flowCount.toLocaleString()}</strong>
  </li>
)

const shortName = (id: string): string => {
  if (id.startsWith('ns:')) return id.slice(3)
  if (id.startsWith('wl:')) return id.slice(3)
  if (id.startsWith('ext:fqdn:')) return id.slice(9)
  if (id === 'ext:unknown') return 'Unknown External'
  return id
}

export default TopTalkersPanel
