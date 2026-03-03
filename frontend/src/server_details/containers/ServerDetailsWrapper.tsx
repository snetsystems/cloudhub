import React, {useState, useEffect, useContext, useRef} from 'react'
import {connect} from 'react-redux'
import {generateForHosts} from 'src/utils/tempVars'
import {SERVER_DETAILS_PAGE_NAME} from 'src/shared/constants/routes'
import DashboardPageWithImport, {
  dashboardPageWithImportMstp,
  dashboardPageWithImportMdtp,
  type TemplateSelectionContextValue,
} from 'src/shared/components/DashboardPageWithImport'
import ProcessLineChartTable from 'src/server_details/components/ProcessLineChartTable'

function ServerDetailsCellContent() {
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info')
  return (
    <div className="server-details-cell-content">
      <div className="dash-graph--draggable dash-graph--heading dash-graph--heading-draggable server-details-cell-header">
        <div className="server-details-cell-tab-buttons">
          <button
            type="button"
            className={activeTab === 'info' ? 'active' : ''}
            onClick={() => setActiveTab('info')}
          >
            Server Info
          </button>
          <button
            type="button"
            className={activeTab === 'files' ? 'active' : ''}
            onClick={() => setActiveTab('files')}
          >
            File System
          </button>
        </div>
        <div className="server-details-cell-drag-handle">
          <div className="dash-graph--heading-bar" />
          <div className="dash-graph--heading-dragger" />
        </div>
      </div>
      <div className="server-details-cell-tabs">
        <div className="server-details-cell-tab-panel">
          {activeTab === 'info' && (
            <div className="server-details-cell-tab-body">서버 정보 내용~</div>
          )}
          {activeTab === 'files' && (
            <div className="server-details-cell-tab-body">파일 시스템 내용</div>
          )}
        </div>
      </div>
    </div>
  )
}
import {Dropdown, DropdownMode} from 'src/reusable_ui'
import {Template, TemplateValue} from 'src/types'
import * as DashboardsModels from 'src/types/dashboards'

type ServerDetailsPageContextValue = TemplateSelectionContextValue & {
  selectedHost: string | null
  onHostSelect: (host: string | null) => void
}

const ServerDetailsPageContext = React.createContext<ServerDetailsPageContextValue | null>(
  null
)

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
        templateSelectionContext={ServerDetailsPageContext as React.Context<TemplateSelectionContextValue | null>}
        renderHeaderLeft={({templates, dashboard, templateVariableLocalSelected}) => (
          <HostDropdownHeader 
            templates={templates} 
            dashboard={dashboard}
            templateVariableLocalSelected={templateVariableLocalSelected}
          />
        )}
        renderCell={(cell, _context) => {
          console.log('context', _context)
          if (cell.i === 'host-table-cell') {
            return <ServerDetailsCellContent />
          }
          if (cell.i === 'hostpage-cell-11') {
            return <ProcessLineChartTable source={props.source} />
            // return <ProcessLineChartTable source={context.source} />

          }
          return null
        }}
      />
    </ServerDetailsPageContext.Provider>
  )
}

export default connect(
  dashboardPageWithImportMstp,
  dashboardPageWithImportMdtp
)(ServerDetailsWrapper)
