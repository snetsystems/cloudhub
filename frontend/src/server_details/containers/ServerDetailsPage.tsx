import React, {useEffect, useState, useMemo} from 'react'
import {connect} from 'react-redux'
import {Cell, Source, Dashboard, CellType, Template, Me} from 'src/types'
import {Button, ComponentColor, Page, OverlayTechnology} from 'src/reusable_ui'
import FixedModal from 'src/reusable_ui/components/FixedModal/FixedModal'
import {getDashboardByTemplateName} from 'src/dashboards/apis'
import {bindActionCreators} from 'redux'

import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import PageSpinner from 'src/shared/components/PageSpinner'
import DashboardEmpty from 'src/dashboards/components/DashboardEmpty'
import * as DashboardsModels from 'src/types/dashboards'
import * as QueriesModels from 'src/types/queries'
import {generateForHosts} from 'src/utils/tempVars'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import CellEditorOverlay from 'src/dashboards/components/CellEditorOverlay'
import {Links} from 'src/types/flux'
import {NotificationAction} from 'src/types'
import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'
import {SERVER_DETAILS_PAGE_NAME} from 'src/shared/constants/routes'
import {
  addDashboardCellAsync,
  cloneDashboardCellAsync,
  deleteDashboardCellAsync,
  updateDashboard,
  putDashboard,
  getDashboardsAsync,
  patchDashboardByIDAsync,
  editCellQueryStatus,
} from 'src/dashboards/actions'
import * as notifyActions from 'src/shared/actions/notifications'

interface Props {
  source: Source
  sources: Source[]
  inPresentationMode: boolean
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  manualRefresh: number
  updateDashboard: typeof updateDashboard
  putDashboard: typeof putDashboard
  addDashboardCellAsync: typeof addDashboardCellAsync
  cloneDashboardCellAsync: typeof cloneDashboardCellAsync
  deleteDashboardCellAsync: typeof deleteDashboardCellAsync
  getDashboardsAsync: typeof getDashboardsAsync
  patchDashboardByIDAsync: typeof patchDashboardByIDAsync
  dashboards?: DashboardsModels.Dashboard[]
  me?: Me
  isUsingAuth?: boolean
  fluxLinks: Links
  notify: NotificationAction
  cellQueryStatus: QueriesModels.QueryStatus
  editCellQueryStatus: typeof editCellQueryStatus
}

interface SelectedItems {
  dashboards: Dashboard[]
  cellTypes: CellType[]
  templates: Template[]
}

function ServerDetailsPage({
  source,
  sources,
  inPresentationMode,
  cloudAutoRefresh,
  cloudTimeRange,
  manualRefresh,
  updateDashboard,
  putDashboard,
  addDashboardCellAsync,
  cloneDashboardCellAsync,
  deleteDashboardCellAsync,
  getDashboardsAsync,
  patchDashboardByIDAsync,
  dashboards,
  me,
  isUsingAuth,
  fluxLinks,
  notify,
  cellQueryStatus,
  editCellQueryStatus,
}: Props) {
  const templateName = SERVER_DETAILS_PAGE_NAME

  const [isModalOpen, setIsModalOpen] = useState(false)

  const [cells, setCells] = useState<Cell[]>([])

  const [currentDashboardId, setCurrentDashboardId] = useState<string>('')

  const [selectedTemplates, setSelectedTemplates] = useState<Template[]>([])

  const [selectedCell, setSelectedCell] = useState<DashboardsModels.Cell | DashboardsModels.NewDefaultCell | null>(null)
  const [isCellEditorOpen, setIsCellEditorOpen] = useState(false)

  const tempVars = generateForHosts(source)

  const dashboard = useMemo(
    () =>
      dashboards?.find(dashboard => {
        if (dashboard.id === currentDashboardId) {
          setCells(dashboard.cells)
          return true
        }
        return false
      }),
    [dashboards]
  )

  useEffect(() => {
    const getDashboardById = async () => {
      console.log('dashboardByName', templateName)

      const dashboardByName = await getDashboardByTemplateName(templateName)
      console.log('dashboardByName', dashboardByName)
      if (dashboardByName) {
        setCurrentDashboardId(dashboardByName.id)
      }
    }
    getDashboardById()

    //get all dashboards
    getDashboardsAsync()
  }, [])

  const onDeleteCell = (cell: Cell) => {
    if (!dashboard) return
    deleteDashboardCellAsync(dashboard, cell)
  }

  const onCloneCell = async (cell: Cell) => {
    if (!dashboard) return
    cloneDashboardCellAsync(dashboard, cell)
  }

  const onPositionChange = (newCells: Cell[]) => {
    if (!dashboard) return
    const newDashboard = {...dashboard, cells: newCells}
    updateDashboard(newDashboard)
    putDashboard(newDashboard)
  }

  const onSummonOverlayTechnologies = (cell: Cell) => {
    setSelectedCell(cell)
    setIsCellEditorOpen(true)
  }

  const handleSaveEditedCell = async (
    newCell: DashboardsModels.Cell | DashboardsModels.NewDefaultCell
  ) => {
    if (!dashboard) {
      setIsCellEditorOpen(false)
      return
    }

    if ((newCell as DashboardsModels.Cell).i !== undefined) {
      const updatedCells = dashboard.cells.map(cell =>
        cell.i === (newCell as DashboardsModels.Cell).i
          ? {...cell, ...newCell}
          : cell
      )
      const newDashboard = {...dashboard, cells: updatedCells}
      updateDashboard(newDashboard)
      await putDashboard(newDashboard)
      setCells(updatedCells)
    } else {
      addDashboardCellAsync(dashboard, newCell as DashboardsModels.NewDefaultCell)
    }

    setIsCellEditorOpen(false)
  }

  const handleCloseCellEditor = () => {
    setIsCellEditorOpen(false)
  }

  const handleSelectionChange = (items: SelectedItems) => {
    setSelectedTemplates(items.templates)

    const dashboardCells = items.dashboards.flatMap(
      dashboard => dashboard.cells
    )
    patchDashboardByIDAsync(currentDashboardId, [...cells, ...dashboardCells])
  }

  const hostDetailsTimeRange =
    cloudTimeRange.hostDetails ?? CLOUD_TIME_RANGE.default
  const hostDetailsRefresh = cloudAutoRefresh.hostDetails ?? 0

  const mergedTemplates = useMemo(() => {
    const templateMap = new Map<string, Template>()

    tempVars.forEach(template => {
      const key = template.tempVar || template.id
      if (key) {
        templateMap.set(key, template)
      }
    })

    selectedTemplates.forEach(template => {
      const key = template.tempVar || template.id
      if (key) {
        templateMap.set(key, template)
      }
    })

    const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
      hostDetailsTimeRange
    )
    templateMap.set(dashboardTime.tempVar || dashboardTime.id, dashboardTime)
    templateMap.set(
      upperDashboardTime.tempVar || upperDashboardTime.id,
      upperDashboardTime
    )

    return Array.from(templateMap.values())
  }, [tempVars, selectedTemplates, hostDetailsTimeRange])

  const dashboardTemplatesForEditor = useMemo(
    () => [...mergedTemplates, ...(dashboard?.templates || [])],
    [mergedTemplates, dashboard?.templates]
  )

  return (
    <Page className="server-details-page">
      {dashboard && selectedCell && (
        <OverlayTechnology visible={isCellEditorOpen}>
          <CellEditorOverlay
            source={source}
            sources={sources}
            me={me}
            isUsingAuth={!!isUsingAuth}
            notify={notify}
            fluxLinks={fluxLinks}
            cell={selectedCell}
            dashboardID={currentDashboardId}
            queryStatus={cellQueryStatus}
            onSave={handleSaveEditedCell}
            onCancel={handleCloseCellEditor}
            dashboardTemplates={dashboardTemplatesForEditor}
            editQueryStatus={editCellQueryStatus}
            dashboardTimeRange={hostDetailsTimeRange}
            dashboardRefresh={hostDetailsRefresh}
          />
        </OverlayTechnology>
      )}
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Server Details" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <Button
            text="Import Modal"
            color={ComponentColor.Primary}
            onClick={() => {
              setIsModalOpen(prev => !prev)
            }}
          />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true} inPresentationMode={inPresentationMode}>
        <div className="dashboard container-fluid full-width">
          {cells.length ? (
            <LayoutRenderer
              cells={cells}
              source={source}
              sources={sources}
              isEditable={true}
              isStatusPage={false}
              isStaticPage={false}
              timeRange={hostDetailsTimeRange}
              manualRefresh={manualRefresh}
              onDeleteCell={onDeleteCell}
              onCloneCell={onCloneCell}
              onPositionChange={onPositionChange}
              templates={mergedTemplates}
              onSummonOverlayTechnologies={onSummonOverlayTechnologies}
              host={source.name}
            />
          ) : dashboard ? (
            <DashboardEmpty dashboard={dashboard} />
          ) : (
            <PageSpinner customClass="server-details-page-spinner" />
          )}
        </div>
      </Page.Contents>
      <FixedModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        onSelectionChange={handleSelectionChange}
      />
    </Page>
  )
}

const mstp = state => {
  const {
    app: {
      ephemeral: {inPresentationMode},
      persisted: {cloudAutoRefresh, cloudTimeRange, manualRefresh},
    },
    auth: {isUsingAuth, me},
    dashboardUI: {dashboards, cellQueryStatus},
    links,
  } = state

  return {
    me,
    isUsingAuth,
    cloudAutoRefresh,
    inPresentationMode,
    cloudTimeRange,
    manualRefresh,
    dashboards,
    fluxLinks: links.flux,
    cellQueryStatus,
  }
}

const mdtp = dispatch => ({
  updateDashboard: bindActionCreators(updateDashboard, dispatch),
  putDashboard: bindActionCreators(putDashboard, dispatch),
  addDashboardCellAsync: bindActionCreators(addDashboardCellAsync, dispatch),
  cloneDashboardCellAsync: bindActionCreators(
    cloneDashboardCellAsync,
    dispatch
  ),
  deleteDashboardCellAsync: bindActionCreators(
    deleteDashboardCellAsync,
    dispatch
  ),
  getDashboardsAsync: bindActionCreators(getDashboardsAsync, dispatch),
  patchDashboardByIDAsync: bindActionCreators(
    patchDashboardByIDAsync,
    dispatch
  ),
  editCellQueryStatus: bindActionCreators(editCellQueryStatus, dispatch),
  notify: bindActionCreators(notifyActions.notify, dispatch),
})

export default connect(mstp, mdtp)(ServerDetailsPage)
