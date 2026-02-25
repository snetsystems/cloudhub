import React from 'react'
import {connect} from 'react-redux'
import {Cell, Source, Me} from 'src/types'
import {Button, ComponentColor, Page} from 'src/reusable_ui'
import FixedModal from 'src/reusable_ui/components/FixedModal/FixedModal'
import {getDashboardByTemplateName} from 'src/dashboards/apis'
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
import {useDashboardPageWithImport} from 'src/server_details/hooks/useDashboardPageWithImport'
import {SERVER_DETAILS_PAGE_NAME} from 'src/shared/constants/routes'

interface Props {
  source: Source
  sources: Source[]
  inPresentationMode: boolean
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  manualRefresh: number
  updateDashboard: typeof updateDashboard
  putDashboard: (dashboard: DashboardsModels.Dashboard) => void | Promise<void>
  addDashboardCellAsync: typeof addDashboardCellAsync
  cloneDashboardCellAsync: typeof cloneDashboardCellAsync
  deleteDashboardCellAsync: typeof deleteDashboardCellAsync
  getDashboardsAsync: typeof getDashboardsAsync
  patchDashboardByIDAsync: typeof patchDashboardByIDAsync
  dispatch: (action: unknown) => Promise<unknown>
  dashboards?: DashboardsModels.Dashboard[]
  me?: Me
  isUsingAuth?: boolean
}

function ServerDetailsWrapper({
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
  dispatch,
  dashboards,
  me,
  isUsingAuth,
}: Props) {
  const tempVars = generateForHosts(source)

  const {
    dashboard,
    cells,
    loadSettled,
    onPositionChange,
    onDeleteCell,
    onCloneCell,
    importModal,
    localTemplates,
    handlePickTemplate,
    handleSaveTemplates,
  } = useDashboardPageWithImport({
    pageName: SERVER_DETAILS_PAGE_NAME,
    fetchDashboardByName: getDashboardByTemplateName,
    dashboards,
    getDashboardsAsync,
    updateDashboard,
    putDashboard,
    patchDashboardByIDAsync,
    addDashboardCellAsync,
    cloneDashboardCellAsync,
    deleteDashboardCellAsync,
    dispatch,
  })

  const onSummonOverlayTechnologies = (_cell: Cell) => {}

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
              importModal.setIsOpen(prev => !prev)
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
          ) : loadSettled ? (
            <div className="dashboard-empty">
              <p>page not available.</p>
            </div>
          ) : (
            <PageSpinner customClass="server-details-page-spinner" />
          )}
        </div>
      </Page.Contents>
      <FixedModal
        isOpen={importModal.isOpen}
        setIsOpen={importModal.setIsOpen}
        onSelectionChange={importModal.onSelectionChange}
        builtinName={SERVER_DETAILS_PAGE_NAME}
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
  putDashboard: (dashboard: DashboardsModels.Dashboard) =>
    dispatch(putDashboard(dashboard)),
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
  dispatch,
})

export default connect(mstp, mdtp)(ServerDetailsWrapper)
