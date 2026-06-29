import React from 'react'
import {HubbleNode} from 'src/hubble/types'
import {NodeTrafficStats} from 'src/hubble/utils/nodeStats'

interface Props {
  selectedNode: HubbleNode | null
  selectedEdgeLabel: string | null
  nodeStats: NodeTrafficStats | null
  onClear: () => void
}

const nodeLabel = (node: HubbleNode): string => {
  if (node.kind === 'external') {
    return node.fqdn || node.label || 'Unknown External'
  }
  return node.name || node.label || node.id
}

const MapSelectionBar: React.FC<Props> = ({
  selectedNode,
  selectedEdgeLabel,
  nodeStats,
  onClear,
}) => {
  if (!selectedNode && !selectedEdgeLabel) {
    return null
  }

  const inFlows = nodeStats
    ? nodeStats.inFlows + nodeStats.internalFlows
    : 0
  const outFlows = nodeStats ? nodeStats.outFlows : 0

  return (
    <div className="hubble-map-selection-bar">
      {selectedNode && (
        <>
          <span className="hubble-map-selection-label">
            선택: <strong>{nodeLabel(selectedNode)}</strong>
            {selectedNode.kind === 'namespace' && (
              <span className="hubble-map-selection-hint">
                {' '}
                — 카드의 Open namespace로 워크로드 맵 이동
              </span>
            )}
          </span>
          {nodeStats && (
            <span className="hubble-map-selection-traffic">
              In <strong>{inFlows.toLocaleString()}</strong>
              {' · '}
              Out <strong>{outFlows.toLocaleString()}</strong>
              <span className="hubble-map-selection-hint">
                {' '}
                — 이웃 카드 %는 연결(엣지) 기여도 (Out→선택 In, In←선택 Out)
              </span>
            </span>
          )}
        </>
      )}
      {selectedEdgeLabel && (
        <span className="hubble-map-selection-label">
          Connection: <strong>{selectedEdgeLabel}</strong>
          <span className="hubble-map-selection-hint">
            {' '}
            — 우측 패널에서 verdict / deny reasons / policies / L7 확인
          </span>
        </span>
      )}
      <button
        type="button"
        className="hubble-map-selection-clear"
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  )
}

export default MapSelectionBar
