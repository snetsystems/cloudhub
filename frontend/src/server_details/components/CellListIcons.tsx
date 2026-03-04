import React from 'react'
import {GRAPH_SVGS} from 'src/dashboards/graphics/graph'
import {CellType} from 'src/types/dashboards'

const ICON_SIZE = 40

const GRAPH_KEYS = Object.keys(GRAPH_SVGS) as (keyof typeof GRAPH_SVGS)[]

/** Normalize API type string to GRAPH_SVGS key (CellType value). */
function findGraphicKey(type: string): keyof typeof GRAPH_SVGS | null {
  const t = (type || '').trim()
  if (!t) return null
  const lower = t.toLowerCase()
  const exact = GRAPH_KEYS.find(k => k === t)
  if (exact !== undefined) return exact
  const key = GRAPH_KEYS.find(k => k.toLowerCase() === lower)
  return key ?? null
}

/**
 * Wrapper that constrains graph-type-selector graphics to a fixed size.
 * Uses a separate ref box so the shared SVG never overflows the cell list icon area.
 */
const iconWrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: ICON_SIZE,
  height: ICON_SIZE,
  flexShrink: 0,
  overflow: 'hidden',
  borderRadius: '4px',
}

const iconInnerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/**
 * Renders the same chart-type graphic as the visualization type selector (graph.tsx),
 * scaled down to fit the Cell List icon area for consistent UI/UX.
 */
export function CellTypeIcon({type}: {type: string}) {
  const key = findGraphicKey(type)
  const graphic = key
    ? GRAPH_SVGS[key]
    : GRAPH_SVGS[CellType.Line]

  return (
    <div style={iconWrapperStyle} className="cell-list-icon-wrapper">
      <div style={iconInnerStyle}>
        {graphic}
      </div>
    </div>
  )
}
