import React, {ReactNode} from 'react'

import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import LayoutCellMenu from 'src/shared/components/LayoutCellMenu'
import LayoutCellHeader from 'src/shared/components/LayoutCellHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import * as DashboardsModels from 'src/types/dashboards'
import {VisType} from 'src/types/flux'

interface Props {
  cell: DashboardsModels.Cell
  context: RenderCellContext
  className: string
  /** Rendered after the body container, e.g. an overlay. */
  after?: ReactNode
  children: ReactNode
}

/**
 * renderCell bypasses LayoutCell, so a component cell brings its own header and
 * context menu; without them it cannot be cloned or deleted. The pencil hides
 * itself for a cell with no queries.
 */
const FixedCellFrame: React.FC<Props> = ({
  cell,
  context,
  className,
  after,
  children,
}) => {
  const {isEditable, onDeleteCell, onCloneCell, onRenameCell} = context

  return (
    <div className={`dash-graph ${className}`}>
      <Authorized requiredRole={EDITOR_ROLE}>
        <LayoutCellMenu
          cell={cell}
          isEditable={isEditable}
          dataExists={false}
          showInformationSupported={false}
          onEdit={() => {}}
          onClone={onCloneCell}
          onDelete={onDeleteCell}
          isCloneable={false}
          onCSVDownload={() => {}}
          onShowInformation={() => {}}
          queries={[]}
          isFluxQuery={false}
          visType={VisType.Graph}
          toggleVisType={() => {}}
        />
      </Authorized>
      <LayoutCellHeader
        cellName={cell.name}
        isEditable={isEditable}
        makeSpaceForCellNote={false}
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        onRename={
          onRenameCell ? (name: string) => onRenameCell(cell, name) : undefined
        }
      />
      <div className="dash-graph--container">{children}</div>
      {after}
    </div>
  )
}

export default FixedCellFrame
