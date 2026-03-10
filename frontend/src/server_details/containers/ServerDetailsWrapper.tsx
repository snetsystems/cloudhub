import React, {useState, useEffect, useContext, useRef, useMemo} from 'react'
import classnames from 'classnames'
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
import type {Cell, Source} from 'src/types'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import * as DashboardsModels from 'src/types/dashboards'
import type {DataTableObject} from 'src/types/tableType'
import type {Addon} from 'src/types/auth'
import ProcessLineChartTable from 'src/server_details/components/ProcessLineChartTable'
import ProcessDetailModal from 'src/server_details/components/ProcessDetailModal'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import MenuTooltipButton from 'src/shared/components/MenuTooltipButton'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {
  ServerDetailsCellContent,
  ServerDetailsPageContext,
  type ServerDetailsPageContextValue,
} from 'src/server_details/components/ServerDetailsCellContent'

interface HostDropdownHeaderProps {
  templates: Template[]
  dashboard?: DashboardsModels.Dashboard
  templateVariableLocalSelected?: (
    dashboardID: string,
    templateID: string,
    value: TemplateValue
  ) => void
}

function HostDropdownHeader({
  templates,
  dashboard,
  templateVariableLocalSelected,
}: HostDropdownHeaderProps) {
  const ctx = useContext(ServerDetailsPageContext)
  const initialSetRef = useRef(false)

  const hostTemplate = useMemo(() => 
    templates?.find(t => t.tempVar === ':host:'), 
    [templates]
  )
  
  const hostList = useMemo(() => 
    hostTemplate?.values?.map(v => v.value) ?? [], 
    [hostTemplate]
  )

  const {selectedHost, onHostSelect} = ctx || {}

  useEffect(() => {
    if (!ctx || !hostTemplate || !dashboard) return

    if (!initialSetRef.current && hostList.length > 0 && selectedHost === null) {
      initialSetRef.current = true
      onHostSelect(hostList[0])
      return
    }

    if (selectedHost && templateVariableLocalSelected) {
      const selectedValue = hostTemplate.values.find(v => v.value === selectedHost)
      if (selectedValue) {
        templateVariableLocalSelected(dashboard.id, hostTemplate.id, {
          ...selectedValue,
          localSelected: true,
        })
      }
    }
  }, [selectedHost, hostList, hostTemplate, dashboard, onHostSelect, templateVariableLocalSelected])

  if (!ctx) return null

  if (hostList.length === 0) {
    return (
      <span className="server-details-page__host-dropdown server-details-page__host-dropdown--placeholder">
        Select Host
      </span>
    )
  }

  return (
    <span className="server-details-page__host-dropdown-wrap">
      <Dropdown
        mode={DropdownMode.ActionList}
        titleText="Select Host"
        selectedID={selectedHost ?? ''}
        onChange={value => onHostSelect(value ?? null)}
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

function ProcessCellContent({
  cell,
  context,
  source,
  addons,
}: {
  cell: Cell
  context: RenderCellContext
  source: Source
  addons?: Addon[]
}) {
  const ctx = useContext(ServerDetailsPageContext)
  const [contextOpen, setContextOpen] = useState(false)
  const [processDetailModalOpen, setProcessDetailModalOpen] = useState(false)
  const [selectedProcessRow, setSelectedProcessRow] =
    useState<DataTableObject | null>(null)

  const openProcessDetail = (row: DataTableObject) => {
    setSelectedProcessRow(row)
    setProcessDetailModalOpen(true)
  }

  return (
    <div className="server-details-cell-content">
      <div className="dash-graph--draggable dash-graph--heading dash-graph--heading-draggable server-details-cell-header">
        <span className="dash-graph--name server-details-cell-header-name">
          Process
        </span>
        <div className="server-details-cell-drag-handle">
          <div className="dash-graph--heading-bar" />
          <div className="dash-graph--heading-dragger" />
        </div>
      </div>
      {context?.onDeleteCell && (
        <div
          className={classnames('dash-graph-context', {
            'dash-graph-context__open': contextOpen,
          })}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="dash-graph-context--buttons">
            <Authorized requiredRole={EDITOR_ROLE}>
              <MenuTooltipButton
                icon="trash"
                theme="danger"
                menuItems={[
                  {
                    text: 'Confirm',
                    action: () => context.onDeleteCell(cell),
                    disabled: false,
                  },
                ]}
                informParent={() => setContextOpen(prev => !prev)}
              />
            </Authorized>
          </div>
        </div>
      )}
      <div className="server-details-cell-tabs">
        <div className="server-details-cell-tab-panel">
          <FancyScrollbar
            className="server-details-cell-tab-panel__scroll"
            style={{height: '100%'}}
            autoHide={false}
          >
            <ProcessLineChartTable
              source={source}
              onProcessNameClick={openProcessDetail}
            />
          </FancyScrollbar>
        </div>
      </div>
      <ProcessDetailModal
        isOpen={processDetailModalOpen}
        onClose={() => {
          setProcessDetailModalOpen(false)
          setSelectedProcessRow(null)
        }}
        serverDetail={{
          selectedHost: ctx?.selectedHost ?? null,
          source,
          addons,
        }}
        nameInfo={selectedProcessRow}
      />
    </div>
  )
}

function ServerDetailsWrapper(props) {
  const [selectedHost, setSelectedHost] = useState<string | null>(null)


  const contextValue : ServerDetailsPageContextValue = useMemo(() => ({
    selectedHost,
    onHostSelect: setSelectedHost,
    templateOverrides: selectedHost != null ? {':host:': selectedHost} : {},
  }), [selectedHost])     

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
        draggableCancel=".server-details-cell-tab-buttons, .dash-graph-context"
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
              <ProcessCellContent
                cell={cell}
                context={context}
                source={props.source}
                addons={props.addons}
              />
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
