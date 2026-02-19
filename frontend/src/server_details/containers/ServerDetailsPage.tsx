import React, {useEffect, useState, useMemo} from 'react'
import {connect} from 'react-redux'
import {
  Cell,
  Source,
  Dashboard,
  CellType,
  Template,
  TemplateValue,
  Me,
} from 'src/types'
import {Button, ComponentColor, Page} from 'src/reusable_ui'
import FixedModal from 'src/reusable_ui/components/FixedModal/FixedModal'
import {getHostsListApi} from 'src/dashboards/apis'
import {bindActionCreators} from 'redux'

import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import PageSpinner from 'src/shared/components/PageSpinner'
import DashboardEmpty from 'src/dashboards/components/DashboardEmpty'
import * as DashboardsModels from 'src/types/dashboards'
import {generateForHosts} from 'src/utils/tempVars'
import {
  addDashboardCellAsync,
  cloneDashboardCellAsync,
  deleteDashboardCellAsync,
  updateDashboard,
  putDashboard,
  getDashboardsAsync,
  patchDashboardByIDAsync,
} from 'src/dashboards/actions'

import TemplateControlBar from 'src/tempVars/components/TemplateControlBar'
import {detectTemplateConflicts} from 'src/server_details/utils/templateConflict'

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
}: Props) {
  // dashboard id
  const HOST_PAGE_NAME = 'host_page'

  const [isModalOpen, setIsModalOpen] = useState(false)

  const [cells, setCells] = useState<Cell[]>([])

  const [currentDashboardId, setCurrentDashboardId] = useState<string>('')

  const [localTemplates, setLocalTemplates] = useState<Template[]>([])

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
      const dashboardByName = await getHostsListApi(HOST_PAGE_NAME)
      if (dashboardByName) {
        setCurrentDashboardId(dashboardByName.id)
      }
    }
    getDashboardById()

    //get all dashboards
    getDashboardsAsync()
  }, [])

  const onAddCell = (cell: Cell) => {
    if (!dashboard) return
    addDashboardCellAsync(dashboard, cell)
  }

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

  const onSummonOverlayTechnologies = (_cell: Cell) => {
    // Cell Editor 띄울 때, 옵션 수정만 가능하게 진행
  }

  const handleSelectionChange = (items: SelectedItems) => {
    setLocalTemplates(items.templates)

    const dashboardCells = items.dashboards.flatMap(
      dashboard => dashboard.cells
    )
    patchDashboardByIDAsync(currentDashboardId, [...cells, ...dashboardCells])
  }

  const handlePickTemplate = (template: Template, value: TemplateValue) => {
    const updated = localTemplates.map(t => {
      if (t.id === template.id) {
        return {
          ...t,
          values: t.values.map(v => ({
            ...v,
            localSelected: v.value === value.value,
          })),
        }
      }
      return t
    })
    setLocalTemplates(updated)
  }

  const handleSaveTemplates = (templates: Template[]) => {
    const templatesWithConflict = detectTemplateConflicts(templates)
    setLocalTemplates(templatesWithConflict)
  }

  return (
    <Page className="server-details-page">
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
      {localTemplates.length > 0 && (
        <TemplateControlBar
          templates={localTemplates}
          me={me}
          isUsingAuth={isUsingAuth || false}
          onSaveTemplates={handleSaveTemplates}
          onPickTemplate={handlePickTemplate}
          source={source}
        />
      )}
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
              timeRange={cloudTimeRange.hostDetails}
              manualRefresh={manualRefresh}
              onDeleteCell={onDeleteCell}
              onCloneCell={onCloneCell}
              onPositionChange={onPositionChange}
              templates={tempVars}
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
    dashboardUI: {dashboards},
  } = state

  return {
    me,
    isUsingAuth,
    cloudAutoRefresh,
    inPresentationMode,
    cloudTimeRange,
    manualRefresh,
    dashboards,
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
})

export default connect(mstp, mdtp)(ServerDetailsPage)
