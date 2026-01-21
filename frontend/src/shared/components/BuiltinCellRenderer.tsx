// Libraries
import React, {FunctionComponent} from 'react'

// Components
import {getBuiltinCellComponent} from 'src/shared/components/BuiltinCellRegistry'

// Types
import {Cell} from 'src/types/dashboards'
import {Source, TimeRange} from 'src/types'

interface Props {
  cell: Cell
  source: Source
  timeRange: TimeRange
  [key: string]: any // Allow additional props to be passed through to components
}

/**
 * BuiltinCellRenderer renders custom components for builtin dashboard cells.
 * It uses the BuiltinCellRegistry to map cell types to their corresponding components.
 *
 * This renderer is generic and does not depend on specific component implementations.
 * New builtin cell types can be added by registering them in BuiltinCellRegistry.
 *
 * Additional props can be passed directly to the component, making it flexible
 * for different use cases without requiring a props provider pattern.
 */
const BuiltinCellRenderer: FunctionComponent<Props> = ({
  cell,
  source,
  timeRange,
  ...additionalProps
}) => {
  const registryEntry = getBuiltinCellComponent(cell)

  if (!registryEntry) {
    // Unknown builtin cell type - return empty div
    return (
      <div className="graph-empty">
        <p data-test="builtin-cell-unknown">
          Unknown builtin cell type: {cell.type || cell.i}
        </p>
      </div>
    )
  }

  const Component = registryEntry.component

  // Wrap component in standard dashboard cell container
  return (
    <div className="dash-graph" style={{height: '100%'}}>
      <div
        className="dash-graph--draggable"
        style={{cursor: 'move', height: '100%'}}
      >
        <div
          className="dash-graph--container"
          style={{height: '100%', overflow: 'hidden'}}
        >
          <Component
            cell={cell}
            source={source}
            timeRange={timeRange}
            {...additionalProps}
          />
        </div>
      </div>
    </div>
  )
}

export default BuiltinCellRenderer
