import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useMemo,
  useCallback,
} from 'react'
import classnames from 'classnames'
import {connect} from 'react-redux'
import qs from 'qs'
import {generateForHosts} from 'src/utils/tempVars'
import {SERVER_DETAILS_PAGE_NAME} from 'src/shared/constants/routes'
import DashboardPageWithImport, {
  dashboardPageWithImportMstp,
  dashboardPageWithImportMdtp,
  type TemplateSelectionContextValue,
} from 'src/shared/components/DashboardPageWithImport'
import {Dropdown, DropdownMode, ComponentSize} from 'src/reusable_ui'
import {Template, TemplateValue} from 'src/types'
import type {Cell, Source} from 'src/types'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import * as DashboardsModels from 'src/types/dashboards'
import type {DataTableObject} from 'src/types/tableType'
import type {Addon} from 'src/types/auth'
import type {CloudTimeRange} from 'src/clouds/types/type'
import {getHosts} from 'src/shared/apis/host'
import ProcessLineChartTable from 'src/server_details/components/ProcessLineChartTable'
import ProcessDetailModal from 'src/server_details/components/ProcessDetailModal'
import UsageDetailModal, {
  type UsageDetailType,
} from 'src/server_details/components/UsageDetailModal'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import MenuTooltipButton from 'src/shared/components/MenuTooltipButton'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {
  ServerDetailsCellContent,
  ServerSummaryInfo,
  ServerDetailsPageContext,
  type ServerDetailsPageContextValue,
} from 'src/server_details/components/ServerDetailsCellContent'
import {getHostByHostname, type Host} from 'src/shared/apis/host'
import type {CellQuery} from 'src/types/dashboards'

type QueryTargetOS = 'windows' | 'linux'

function normalizeHostOSToTargetOS(os?: string | null): QueryTargetOS {
  return os === 'Windows' ? 'windows' : 'linux'
}

function applySkipByTargetOS<T>(
  queries: T[] | undefined,
  targetOS: QueryTargetOS
): T[] | undefined {
  if (!queries?.length) return queries
  return queries.map(q => {
    const qOS = (q as any).queryTargetOS
    if (!qOS) return q
    const isSkip = qOS.toLowerCase() !== targetOS
    return {...q, isSkip}
  })
}

interface HostDropdownHeaderProps {
  templates: Template[]
  dashboard?: DashboardsModels.Dashboard
  source: Source
  hostData?: Host | null
  templateVariableLocalSelected?: (
    dashboardID: string,
    templateID: string,
    value: TemplateValue
  ) => void
  onTemplateAvailabilityChange?: (gate: {
    resolved: boolean
    blocked: boolean
  }) => void
}

function HostDropdownHeader({
  templates,
  dashboard,
  source,
  hostData,
  templateVariableLocalSelected,
  onTemplateAvailabilityChange,
}: HostDropdownHeaderProps) {
  const ctx = useContext(ServerDetailsPageContext)
  const initialSetRef = useRef(false)
  const [apiHostsResult, setApiHostsResult] = useState<any>(null)

  useEffect(() => {
    getHosts()
      .then(data => {
        setApiHostsResult(data)
      })
      .catch(err => {
        console.error('getHosts error:', err)
        setApiHostsResult({error: err.message})
      })
  }, [])

  const hostTemplate = useMemo(() => 
    templates?.find(t => t.tempVar === ':host:'), 
    [templates]
  )
  
  const hostList = useMemo(() => {
    const defaultList = hostTemplate?.values?.map(v => v.value) ?? []
    if (Array.isArray(apiHostsResult)) {
      const allowedHosts = new Set(apiHostsResult.map((h: any) => h.hostname))
      return defaultList.filter(host => allowedHosts.has(host as string))
    }
    return defaultList
  }, [hostTemplate, apiHostsResult])

  useEffect(() => {
    if (!onTemplateAvailabilityChange) {
      return
    }
    if (apiHostsResult === null) {
      return
    }
    onTemplateAvailabilityChange({
      resolved: true,
      blocked: hostList.length === 0,
    })
  }, [apiHostsResult, hostList, onTemplateAvailabilityChange])

  const {selectedHost, onHostSelect} = ctx || {}
  
  const DEFAULT_DISK_TOTAL_QUERY =
    'SELECT sum("last_total") / 1073741824 AS "disk_total_gib" FROM (SELECT last("total") AS "last_total" FROM ":db:".":rp:"."disk" WHERE time > now() - 15m AND "host" = :host: GROUP BY "path")'

  const diskTotalQuery = useMemo(() => {
    const summaryCell = dashboard?.cells?.find(c => c.i === 'server-details-summary')
    return (
      (summaryCell?.queries as any[])?.find(q => q.label === 'disk-total')?.query ||
      DEFAULT_DISK_TOTAL_QUERY
    )
  }, [dashboard])

  useEffect(() => {
    if (!ctx || !hostTemplate || !dashboard) return

    if (!initialSetRef.current && hostList.length > 0 && selectedHost === null) {
      initialSetRef.current = true
      onHostSelect(hostList[0])
      return
    }

    if (selectedHost && templateVariableLocalSelected) {
      const selectedValue = hostTemplate.values.find(v => v.value === selectedHost)
      const currentSelected = hostTemplate.values.find(v => v.selected || v.localSelected)
      
      if (selectedValue && currentSelected?.value !== selectedHost) {
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
    <div style={{ display: 'flex', alignItems: 'center' }}>
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
      <ServerSummaryInfo
        selectedHost={selectedHost}
        source={source}
        templates={templates}
        diskTotalQuery={diskTotalQuery}
        hostData={hostData}
      />
    </div>
  )
}

const LIMIT_OPTIONS = [
  {id: 'all', name: 'All', value: 0},
  {id: '10', name: '10', value: 10},
  {id: '20', name: '20', value: 20},
  {id: '50', name: '50', value: 50},
]

function ProcessCellContent({
  cell,
  context,
  source,
  addons,
  autoRefresh,
  onAutoRefreshChange,
  cloudTimeRange,
  onChooseCloudTimeRange,
}: {
  cell: Cell
  context: RenderCellContext
  source: Source
  addons?: Addon[]
  autoRefresh: number
  onAutoRefreshChange: (milliseconds: number) => void
  cloudTimeRange: CloudTimeRange
  onChooseCloudTimeRange: (next: CloudTimeRange) => void
}) {
  const ctx = useContext(ServerDetailsPageContext)
  const [contextOpen, setContextOpen] = useState(false)
  const [processLimit, setProcessLimit] = useState<number>(10)
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
            <div className="server-details-process-limit-dropdown" style={{marginRight: '4px'}}>
              <Dropdown
                widthPixels={70}
                buttonSize={ComponentSize.ExtraSmall}
                selectedID={LIMIT_OPTIONS.find(opt => opt.value === processLimit)?.id ?? '10'}
                onChange={id => {
                  const opt = LIMIT_OPTIONS.find(o => o.id === id)
                  if (opt) setProcessLimit(opt.value)
                }}
              >
                {LIMIT_OPTIONS.map(opt => (
                  <Dropdown.Item key={opt.id} id={opt.id} value={opt.id}>
                    {opt.name}
                  </Dropdown.Item>
                ))}
              </Dropdown>
            </div>
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
              selectedHost={ctx?.selectedHost ?? null}
              timeRange={context.timeRange}
              manualRefresh={context.manualRefresh}
              onProcessNameClick={openProcessDetail}
              limit={processLimit}
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
          timeRange: context.timeRange,
          manualRefresh: context.manualRefresh,
        }}
        nameInfo={selectedProcessRow}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={onAutoRefreshChange}
        onCloudTimeRangeChange={tr =>
          onChooseCloudTimeRange({...cloudTimeRange, hostDetails: tr})
        }
      />
    </div>
  )
}


function ServerDetailsWrapper(props) {
  const hostFromUrl = useMemo(() => {
    const params = qs.parse(window.location.search, {ignoreQueryPrefix: true})
    const h = params.host
    return typeof h === 'string' && h.trim() ? h : null
  }, [])

  const [selectedHost, setSelectedHost] = useState<string | null>(hostFromUrl)
  const [hostData, setHostData] = useState<Host | null>(null)
  const [targetOS, setTargetOS] = useState<QueryTargetOS>('linux')
  const [templateAvailabilityGate, setTemplateAvailabilityGate] = useState<{
    resolved: boolean
    blocked: boolean
  }>({resolved: false, blocked: false})

  const handleTemplateAvailabilityChange = useCallback(
    (gate: {resolved: boolean; blocked: boolean}) => {
      setTemplateAvailabilityGate(gate)
    },
    []
  )

  useEffect(() => {
    setTemplateAvailabilityGate({resolved: false, blocked: false})
  }, [props.source?.id])

  const USAGE_DETAIL_ACTION_ID = 'open-usage-detail'

  const [layoutTemplates, setLayoutTemplates] = useState<Template[] | null>(
    null
  )

  const [usageDetailState, setUsageDetailState] = useState<{
    isOpen: boolean
    detailType: UsageDetailType | null
    detailQueries?: CellQuery[]
  }>({
    isOpen: false,
    detailType: null,
  })

  const mapCellIdToUsageDetailType = (cellId?: string | null): UsageDetailType | null => {
    if (!cellId) return null
    switch (cellId) {
      case 'server-details-cpu-usage':
        return 'cpu'
      case 'server-details-memory-usage':
        return 'memory'
      case 'server-details-network-usage':
        return 'network'
      case 'server-details-disk-io-usage':
      case 'server-details-disk-used-spaces':
        return 'disk'
      default:
        return null
    }
  }

  const openUsageDetail = (cell: Cell) => {
    const detailType = mapCellIdToUsageDetailType(cell?.i)
    if (!detailType) return
    const detailQueries = applySkipByTargetOS<CellQuery>(
      (cell as any).detailQueries,
      targetOS
    )
    setUsageDetailState({isOpen: true, detailType, detailQueries})
  }
  useEffect(() => {
    if (!selectedHost) {
      setHostData(null)
      setTargetOS('linux')
      return
    }

    let cancelled = false
    getHostByHostname(selectedHost)
      .then(host => {
        if (!cancelled) {
          setHostData(host)
          setTargetOS(normalizeHostOSToTargetOS(host?.os))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHostData(null)
          setTargetOS('linux')
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedHost])

  const transformCellByOS = useCallback(
    (cell: Cell): Cell => {
      const queries = applySkipByTargetOS<DashboardsModels.CellQuery>(
        (cell as any).queries,
        targetOS
      )
      const detailQueries = applySkipByTargetOS<CellQuery>(
        (cell as any).detailQueries,
        targetOS
      )
      return {
        ...cell,
        ...(queries !== undefined ? {queries} : {}),
        ...(detailQueries !== undefined ? {detailQueries} : {}),
      }
    },
    [targetOS]
  )


  const handleCloseUsageDetail = () => {
    setUsageDetailState(prev => ({...prev, isOpen: false, detailQueries: undefined}))
  }

  const getExtraActionsForCell = (cell: Cell) => {
    const detailType = mapCellIdToUsageDetailType(cell?.i)
    if (!detailType) return []

    return [
      {
        id: USAGE_DETAIL_ACTION_ID,
        label: '상세 보기',
      },
    ]
  }

  const handleCustomCellAction = (cell: Cell, actionId: string) => {
    if (actionId === USAGE_DETAIL_ACTION_ID) {
      openUsageDetail(cell)
    }
  }


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
        noDataMessage="No data"
        templateAvailabilityGate={templateAvailabilityGate}
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
            source={props.source}
            hostData={hostData}
            templateVariableLocalSelected={templateVariableLocalSelected}
            onTemplateAvailabilityChange={handleTemplateAvailabilityChange}
          />
        )}
        renderCell={(cell, context) => {
          if (
            cell.i === 'server-details-server-info'
          ) {
            return (
              <ServerDetailsCellContent
                addons={props.addons}
                cell={cell}
                layoutContext={context}
              />
            )
          }
          if (cell.i === 'server-details-process') {
            return (
              <ProcessCellContent
                cell={cell}
                context={context}
                source={props.source}
                addons={props.addons}
                autoRefresh={props.autoRefresh}
                onAutoRefreshChange={props.setAutoRefresh}
                cloudTimeRange={props.cloudTimeRange}
                onChooseCloudTimeRange={props.onChooseCloudTimeRange}
              />
            )
          }
          return null
        }}
        transformCell={transformCellByOS}
        getExtraActionsForCell={getExtraActionsForCell}
        onCustomCellAction={handleCustomCellAction}
        onLayoutTemplatesChange={setLayoutTemplates}
      />
      <UsageDetailModal
        isOpen={usageDetailState.isOpen}
        onClose={handleCloseUsageDetail}
        detailType={usageDetailState.detailType}
        layoutTemplates={layoutTemplates}
        serverContext={{
          selectedHost,
          source: props.source ?? null,
          addons: props.addons,
          timeRange: props.cloudTimeRange?.hostDetails ?? props.cloudTimeRange?.default,
          detailQueries: usageDetailState.detailQueries,
        }}
        autoRefresh={props.autoRefresh}
        onAutoRefreshChange={props.setAutoRefresh}
        onCloudTimeRangeChange={tr =>
          props.onChooseCloudTimeRange({
            ...props.cloudTimeRange,
            hostDetails: tr,
          })
        }
      />
    </ServerDetailsPageContext.Provider>
  )
}

const mstp = state => ({
  ...dashboardPageWithImportMstp(state),
  addons: state.links?.addons ?? [],
})

export default connect(mstp, dashboardPageWithImportMdtp)(ServerDetailsWrapper)
