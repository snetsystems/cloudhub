import React, {useState, useEffect, useContext, useRef} from 'react'
import {connect} from 'react-redux'
import {generateForHosts} from 'src/utils/tempVars'
import {SERVER_DETAILS_PAGE_NAME} from 'src/shared/constants/routes'
import DashboardPageWithImport, {
  dashboardPageWithImportMstp,
  dashboardPageWithImportMdtp,
  type TemplateSelectionContextValue,
} from 'src/shared/components/DashboardPageWithImport'
import {Dropdown, DropdownMode} from 'src/reusable_ui'
import {Template, TemplateValue} from 'src/types'
import * as DashboardsModels from 'src/types/dashboards'
import ProcessLineChartTable from 'src/server_details/components/ProcessLineChartTable'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {
  ServerDetailsCellContent,
  ServerDetailsPageContext,
  type ServerDetailsPageContextValue,
} from 'src/server_details/components/ServerDetailsCellContent'

function HostDropdownHeader({
  templates,
  dashboard,
  templateVariableLocalSelected,
}: {
  templates: Template[]
  dashboard?: DashboardsModels.Dashboard
  templateVariableLocalSelected?: (
    dashboardID: string,
    templateID: string,
    value: TemplateValue
  ) => void
}) {
  const ctx = useContext(ServerDetailsPageContext)
  const hostTemplate = templates?.find(t => t.tempVar === ':host:')
  const hostList = hostTemplate?.values?.map(v => v.value) ?? []
  const initialSetRef = useRef(false)

  useEffect(() => {
    if (hostList.length > 0 && ctx?.selectedHost === null && !initialSetRef.current) {
      initialSetRef.current = true
      ctx.onHostSelect(hostList[0])
    }
  }, [hostList, ctx?.selectedHost, ctx?.onHostSelect])

  useEffect(() => {
    if (ctx?.selectedHost && hostTemplate && dashboard && templateVariableLocalSelected) {
      const selectedValue = hostTemplate.values.find(v => v.value === ctx.selectedHost)
      if (selectedValue) {
        templateVariableLocalSelected(dashboard.id, hostTemplate.id, {
          ...selectedValue,
          localSelected: true,
        })
      }
    }
  }, [ctx?.selectedHost, hostTemplate, dashboard, templateVariableLocalSelected])

  if (!ctx) return null
  const current = ctx.selectedHost ?? ''
  if (hostList.length === 0) {
    return (
      <span
        style={{marginLeft: 12}}
        className="server-details-page__host-dropdown server-details-page__host-dropdown--placeholder"
      >
        Select Host
      </span>
    )
  }
  return (
    <span
      style={{marginLeft: 12, flexShrink: 0, minWidth: 0}}
      className="server-details-page__host-dropdown-wrap"
    >
      <Dropdown
        mode={DropdownMode.ActionList}
        titleText="Select Host"
        selectedID={current}
        onChange={value => ctx.onHostSelect(value ?? null)}
        customClass="server-details-page__host-dropdown"
        widthPixels={150}
      >
        {hostList.map(host => (
          <Dropdown.Item key={host} id={host} value={host}>
            {host}
          </Dropdown.Item>
        ))}
      </Dropdown>
    </span>
  )
}

function ServerDetailsWrapper(props) {
  const [selectedHost, setSelectedHost] = useState<string | null>(null)
  const contextValue: ServerDetailsPageContextValue = {
    selectedHost,
    onHostSelect: setSelectedHost,
    templateOverrides:
      selectedHost != null ? {':host:': selectedHost} : {},
  }

  return (
    <ServerDetailsPageContext.Provider value={contextValue}>
      <DashboardPageWithImport
        {...props}
        pageTitle="Server Details"
        pageName={SERVER_DETAILS_PAGE_NAME}
        getTempVars={generateForHosts}
        pageClassName="server-details-page"
        showEmptyState={false}
        requiredTemplateVars={[':host:']}
        draggableCancel=".server-details-cell-tab-buttons"
        templateSelectionContext={
          ServerDetailsPageContext as React.Context<TemplateSelectionContextValue | null>
        }
        renderHeaderLeft={({
          templates,
          dashboard,
          templateVariableLocalSelected,
        }) => (
          <HostDropdownHeader
            templates={templates}
            dashboard={dashboard}
            templateVariableLocalSelected={templateVariableLocalSelected}
          />
        )}
        renderCell={(cell, context) => {
          if (
            cell.i === 'sever-details-server-info'
          ) {
            return (
              <ServerDetailsCellContent
                addons={props.addons}
                cell={cell}
                layoutContext={context}
              />
            )
          }
          if (cell.i === 'sever-details-process') {
            return (
              <div className="server-details-cell-content">
                <div className="dash-graph--draggable dash-graph--heading dash-graph--heading-draggable server-details-cell-header">
                  <span className="server-details-cell-header-name">Process</span>
                  <div className="server-details-cell-drag-handle">
                    <div className="dash-graph--heading-bar" />
                    <div className="dash-graph--heading-dragger" />
                  </div>
                </div>
                <div className="server-details-cell-tabs">
                  <div className="server-details-cell-tab-panel">
                    <FancyScrollbar
                      className="server-details-cell-tab-panel__scroll"
                      style={{height: '100%'}}
                      autoHide={false}
                    >
                      <ProcessLineChartTable source={props.source} />
                    </FancyScrollbar>
                  </div>
                </div>
              </div>
            )
          }
          return null
        }}
      />
    </ServerDetailsPageContext.Provider>
  )
}

const mstp = state => ({
  ...dashboardPageWithImportMstp(state),
  addons: state.links?.addons ?? [],
})

export default connect(mstp, dashboardPageWithImportMdtp)(ServerDetailsWrapper)
