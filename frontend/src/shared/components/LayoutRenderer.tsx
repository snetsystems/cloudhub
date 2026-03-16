// Libraries
import React, {Component} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'

// Components
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import Layout from 'src/shared/components/Layout'
const GridLayout = WidthProvider(ReactGridLayout)

// Utils
import {fastMap} from 'src/utils/fast'

// Constants
import {
  // TODO: get these const values dynamically
  STATUS_PAGE_ROW_COUNT,
  PAGE_HEADER_HEIGHT,
  PAGE_CONTAINER_MARGIN,
  LAYOUT_MARGIN,
  DASHBOARD_LAYOUT_ROW_HEIGHT,
  STATIC_LAYOUT_ROW_HEIGHT,
} from 'src/shared/constants'

// Types
import {TimeRange, Cell, Template, Source, TemplateValue, AnnotationViewer} from 'src/types'
import type {CellExtraAction} from 'src/types/dashboards'

import {ErrorHandling} from 'src/shared/decorators/errors'

/** Context passed to renderCell when provided; use for fixed/custom cell rendering. */
export interface RenderCellContext {
  source: Source
  sources: Source[]
  host: string
  templates: Template[]
  timeRange: TimeRange
  isEditable: boolean
  manualRefresh: number
  onDeleteCell?: (cell: Cell) => void
  onCloneCell?: (cell: Cell) => void
  onSummonOverlayTechnologies?: (cell: Cell) => void
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  instance?: object
}

interface Props {
  source: Source
  cells: Cell[]
  timeRange: TimeRange
  templates: Template[]
  sources: Source[]
  host: string
  manualRefresh: number
  isStatusPage: boolean
  isStaticPage: boolean
  isEditable: boolean
  onZoom?: () => void
  onCloneCell?: (cell: Cell) => void
  onDeleteCell?: (cell: Cell) => void
  onSummonOverlayTechnologies?: (cell: Cell) => void
  onPositionChange?: (cells: Cell[]) => void
  instance?: object
  onPickTemplate?: (template: Template, value: TemplateValue) => void
  isUsingAnnotationViewer?: boolean
  annotationsViewMode?: AnnotationViewer[]
  /** When provided, called per cell; return a ReactNode for fixed/custom cells, or null to use default Layout. */
  renderCell?: (cell: Cell, context: RenderCellContext) => React.ReactNode | null
  draggableCancel?: string
  /** Optional: return extra action buttons per cell (frontend-only, no backend). */
  getExtraActionsForCell?: (cell: Cell) => CellExtraAction[]
  /** Called when user clicks an injected extra action. */
  onCustomCellAction?: (cell: Cell, actionId: string) => void
}

interface State {
  rowHeight: number
}

@ErrorHandling
class LayoutRenderer extends Component<Props, State> {
  private _isMounted = false

  constructor(props) {
    super(props)

    this.state = {
      rowHeight: this.calculateRowHeight(),
    }
  }

  componentDidMount() {
    this._isMounted = true
  }

  componentWillUnmount() {
    this._isMounted = false
  }

  public render() {
    const {
      host,
      cells,
      source,
      sources,
      onZoom,
      templates,
      timeRange,
      isEditable,
      manualRefresh,
      onDeleteCell,
      onCloneCell,
      onSummonOverlayTechnologies,
      instance,
      onPickTemplate,
      renderCell,
      getExtraActionsForCell,
      onCustomCellAction,
    } = this.props

    const {rowHeight} = this.state
    const isDashboard = !!this.props.onPositionChange
    const layoutContext: RenderCellContext = {
      source,
      sources,
      host,
      templates,
      timeRange,
      isEditable,
      manualRefresh,
      onDeleteCell,
      onCloneCell,
      onSummonOverlayTechnologies,
      onPickTemplate,
      instance,
    }

    return (
      <Authorized
        requiredRole={EDITOR_ROLE}
        propsOverride={{
          isDraggable: false,
          isResizable: false,
          draggableHandle: null,
        }}
      >
        <GridLayout
          layout={cells}
          cols={96}
          rowHeight={rowHeight}
          margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
          containerPadding={[0, 0]}
          useCSSTransforms={false}
          onLayoutChange={this.handleLayoutChange}
          draggableHandle={'.dash-graph--draggable'}
          draggableCancel={this.props.draggableCancel || ''}
          isDraggable={isDashboard}
          isResizable={isDashboard}
        >
          {fastMap(cells, cell => {
            const customContent =
              renderCell != null ? renderCell(cell, layoutContext) : null
            return (
              <div key={cell.i}>
                <Authorized
                  requiredRole={EDITOR_ROLE}
                  propsOverride={{
                    isEditable: false,
                  }}
                >
                  {customContent != null ? (
                    customContent
                  ) : (
                    <Layout
                      key={cell.i}
                      cell={cell}
                      host={host}
                      source={source}
                      onZoom={onZoom}
                      sources={sources}
                      templates={templates}
                      timeRange={timeRange}
                      isEditable={isEditable}
                      onDeleteCell={onDeleteCell}
                      onCloneCell={onCloneCell}
                      getExtraActionsForCell={getExtraActionsForCell}
                      onCustomCellAction={onCustomCellAction}
                      manualRefresh={manualRefresh}
                      onSummonOverlayTechnologies={onSummonOverlayTechnologies}
                      instance={instance}
                      onPickTemplate={onPickTemplate}
                      isUsingAnnotationViewer={this.props.isUsingAnnotationViewer}
                      annotationsViewMode={this.props.annotationsViewMode}
                    />
                  )}
                </Authorized>
              </div>
            )
          })}
        </GridLayout>
      </Authorized>
    )
  }

  private handleLayoutChange = layout => {
    if (!this.props.onPositionChange) {
      return
    }

    let changed = false

    const newCells = this.props.cells.map(cell => {
      const l = layout.find(ly => ly.i === cell.i)

      if (
        cell.x !== l.x ||
        cell.y !== l.y ||
        cell.h !== l.h ||
        cell.w !== l.w
      ) {
        changed = true
      }

      const newLayout = {
        x: l.x,
        y: l.y,
        h: l.h,
        w: l.w,
      }

      return {
        ...cell,
        ...newLayout,
      }
    })

    if (changed) {
      // Defer so react-grid-layout/DraggableCore finish their work first.
      // Prevents "Unable to find node on an unmounted component" when
      // parent re-render runs during drag end.
      const callback = this.props.onPositionChange
      const cellsToApply = newCells
      setTimeout(() => {
        if (this._isMounted && callback) {
          callback(cellsToApply)
        }
      }, 0)
    }
  }

  // ensures that Status Page height fits the window
  private calculateRowHeight = () => {
    const {isStatusPage, isStaticPage} = this.props

    if (isStatusPage) {
      return (
        (window.innerHeight -
          STATUS_PAGE_ROW_COUNT * LAYOUT_MARGIN -
          PAGE_HEADER_HEIGHT -
          PAGE_CONTAINER_MARGIN -
          PAGE_CONTAINER_MARGIN) /
        STATUS_PAGE_ROW_COUNT
      )
    } else if (isStaticPage) {
      return STATIC_LAYOUT_ROW_HEIGHT
    }

    return DASHBOARD_LAYOUT_ROW_HEIGHT
  }
}

export default LayoutRenderer
