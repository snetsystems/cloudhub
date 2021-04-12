// Libraries
import React, {PureComponent, MouseEvent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// Components
import GridLayoutSearchBar from 'src/addon/128t/components/GridLayoutSearchBar'
import RouterTableRow from 'src/addon/128t/components/RouterTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {NoHostsState, sortableClasses} from 'src/addon/128t/reusable'
import Dropdown from 'src/shared/components/Dropdown'
import LoadingSpinner from 'src/flux/components/LoadingSpinner'
import DataPopup from 'src/addon/128t/components/DataPopup'
import {
  CellName,
  HeadingBar,
  PanelHeader,
  Panel,
  PanelBody,
  Table,
  TableHeader,
  TableBody,
} from 'src/addon/128t/reusable/layout'

// Authorized
import {ADMIN_ROLE, SUPERADMIN_ROLE} from 'src/auth/Authorized'

// type
import {
  RouterNode,
  TopSource,
  TopSession,
  SortDirection,
  SaltDirFile,
  SaltDirFileInfo,
  OncueData,
} from 'src/addon/128t/types'

import {Me, ShellInfo} from 'src/types'

// constants
import {ROUTER_TABLE_SIZING} from 'src/addon/128t/constants'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

export interface Props {
  me: Me
  cellBackgroundColor: string
  cellTextColor: string
  isEditable: boolean
  routerNodes: RouterNode[]
  isRoutersAllCheck: boolean
  focusedNodeName: string
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedNodeName: string
  ) => () => void
  handleOnChoose: ({selectItem: string}) => void
  handleRouterCheck: ({routerNode: RouterNode}) => void
  handleRoutersAllCheck: () => void
  handleFocusedBtnName: ({buttonName: string}) => void
  firmware: SaltDirFile
  config: SaltDirFile
  isRouterDataPopupVisible: boolean
  routerPopupPosition: {top: number; right: number}
  handleOnClickNodeName: (data: {
    _event: MouseEvent<HTMLElement>
    routerNode: RouterNode
  }) => void
  hanldeOnDismiss: () => void
  handleOnClickProtocolModulesRow: (name: string) => void
  handleOnClickDeviceConnectionsRow: (url: string) => void
  handleOnClickShellModalOpen: (shell: ShellInfo) => void
  oncueData: OncueData
  routerDataPopupAutoRefresh: number
  onChooseRouterDataPopupAutoRefresh: (milliseconds: number) => void
  onManualRouterDataPopupRefresh: () => void
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  routerCount: number
}

interface HeadingButton {
  buttonName: string
  isNew: boolean
  handleOnChoose?: ({_this: object, selectItem: string}) => void
  handleFocusedBtnName: ({buttonName: string}) => void
  items: string[]
  buttonStatus: boolean
  isDisabled: boolean
}

@ErrorHandling
class RouterTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'nodeName',
      routerCount: 0,
    }
  }

  public getSortedRouters = memoize(
    (
      routerNode: RouterNode[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(routerNode, searchTerm), sortKey, sortDirection)
  )

  public componentWillMount() {
    const {routerNodes} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedRouters: RouterNode[] = this.getSortedRouters(
      routerNodes,
      searchTerm,
      sortKey,
      sortDirection
    )
    this.setState({routerCount: sortedRouters.length})
  }

  private getHandleOnChoose = (selectItem: {text: string}) => {
    this.props.handleOnChoose({selectItem: selectItem.text})
  }

  private HeadingButton = (props: HeadingButton) => {
    const {
      buttonName,
      isNew,
      items,
      handleFocusedBtnName,
      buttonStatus,
      isDisabled,
    } = props
    return (
      <div className={'dash-graph--heading--button-box'}>
        {buttonStatus ? (
          <div className={'loading-box'}>
            <LoadingSpinner />
          </div>
        ) : null}

        {isNew ? <span className="is-new">new</span> : ''}
        <Dropdown
          items={items}
          onChoose={this.getHandleOnChoose}
          selected={buttonName}
          className="dropdown-stretch"
          disabled={isDisabled}
          onClick={() => {
            handleFocusedBtnName({buttonName})
          }}
        />
      </div>
    )
  }
  public extractionFilesName = (items: SaltDirFileInfo[]): string[] => {
    return items.map(item => item.applicationFullName)
  }
  public render() {
    const {
      me,
      isEditable,
      cellTextColor,
      cellBackgroundColor,
      routerNodes,
      handleOnChoose,
      firmware,
      config,
      handleFocusedBtnName,
    } = this.props

    const meRole = _.get(me, 'role', '')

    return (
      <Panel>
        <PanelHeader isEditable={isEditable}>
          <CellName
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            value={routerNodes}
            name={'Routers'}
          />
          <HeadingBar
            isEditable={isEditable}
            cellBackgroundColor={cellBackgroundColor}
          />
          {(meRole === SUPERADMIN_ROLE || meRole === ADMIN_ROLE) && (
            <this.HeadingButton
              buttonName={'Firmware'}
              isNew={this.newChecker(firmware.files)}
              handleOnChoose={handleOnChoose}
              handleFocusedBtnName={handleFocusedBtnName}
              items={this.extractionFilesName(firmware.files)}
              buttonStatus={firmware.isLoading}
              isDisabled={false}
            />
          )}
          {(meRole === SUPERADMIN_ROLE || meRole === ADMIN_ROLE) && (
            <this.HeadingButton
              buttonName={'Config'}
              isNew={this.newChecker(config.files)}
              handleFocusedBtnName={handleFocusedBtnName}
              items={this.extractionFilesName(config.files)}
              buttonStatus={config.isLoading}
              isDisabled={false}
            />
          )}
          <GridLayoutSearchBar
            placeholder="Filter by Router..."
            onSearch={this.updateSearchTerm}
          />
        </PanelHeader>
        <PanelBody>
          <Table>
            <TableHeader>{this.TableHeader}</TableHeader>
            <TableBody>{this.TableData}</TableBody>
          </Table>
        </PanelBody>
      </Panel>
    )
  }

  private newChecker = (items: SaltDirFileInfo[]): boolean => {
    if (items.length === 0) return
    const today = new Date().getTime()
    const oneDay = 86400000

    return items[0].updateGetTime + oneDay > today
  }

  private get TableHeader() {
    const {
      NODENAME,
      GROUP,
      IPADDRESS,
      LOCATIONCOORDINATES,
      MANAGEMENTCONNECTED,
      BANDWIDTH_AVG,
      SESSION_CNT_AVG,
      ENABLED,
      ROLE,
      STARTTIME,
      SOFTWAREVERSION,
      MEMORYUSAGE,
      CPUUSAGE,
      DISKUSAGE,
      CHECKBOX,
    } = ROUTER_TABLE_SIZING
    const {sortKey, sortDirection} = this.state
    const {isRoutersAllCheck, handleRoutersAllCheck} = this.props
    return (
      <>
        <div
          className={sortableClasses({sortKey, sortDirection, key: 'nodeName'})}
          style={{width: CHECKBOX}}
        >
          <div className="dark-checkbox">
            <input
              id={'router-table--all-check'}
              type="checkbox"
              checked={isRoutersAllCheck}
              onClick={handleRoutersAllCheck}
              readOnly
            />
            <label htmlFor={'router-table--all-check'} />
          </div>
        </div>
        <div
          onClick={this.updateSort('nodeName')}
          className={sortableClasses({sortKey, sortDirection, key: 'nodeName'})}
          style={{width: NODENAME}}
        >
          Node Name
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('group')}
          className={sortableClasses({sortKey, sortDirection, key: 'group'})}
          style={{width: GROUP}}
        >
          Group
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('ipAddress')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'ipAddress',
          })}
          style={{width: IPADDRESS}}
        >
          IP Address
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('role')}
          className={sortableClasses({sortKey, sortDirection, key: 'role'})}
          style={{width: ROLE}}
        >
          Role
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('enabled')}
          className={sortableClasses({sortKey, sortDirection, key: 'enabled'})}
          style={{width: ENABLED}}
        >
          Enabled
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('locationCoordinates')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'locationCoordinates',
          })}
          style={{width: LOCATIONCOORDINATES}}
        >
          Location
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('managementConnected')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'managementConnected',
          })}
          style={{width: MANAGEMENTCONNECTED}}
        >
          Connected
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('startTime')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'startTime',
          })}
          style={{width: STARTTIME}}
        >
          Uptime
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('softwareVersion')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'softwareVersion',
          })}
          style={{width: SOFTWAREVERSION}}
        >
          Version
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('cpuUsage')}
          className={sortableClasses({sortKey, sortDirection, key: 'cpuUsage'})}
          style={{width: CPUUSAGE}}
        >
          CPU
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('memoryUsage')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'memoryUsage',
          })}
          style={{width: MEMORYUSAGE}}
        >
          Memory
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('diskUsage')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'diskUsage',
          })}
          style={{width: DISKUSAGE}}
        >
          Disk(/)
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('bandwidth_avg')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'bandwidth_avg',
          })}
          style={{width: BANDWIDTH_AVG}}
        >
          Average <br /> Band Width
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('session_arrivals')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'session_arrivals',
          })}
          style={{width: SESSION_CNT_AVG}}
        >
          Session
          <br />
          Arrivals
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  private get TableData() {
    const {
      routerNodes,
      focusedNodeName,
      onClickTableRow,
      handleRouterCheck,
      handleOnClickNodeName,
      handleOnClickShellModalOpen,
      isRouterDataPopupVisible,
      hanldeOnDismiss,
      routerPopupPosition,
      oncueData,
      routerDataPopupAutoRefresh,
      onChooseRouterDataPopupAutoRefresh,
      onManualRouterDataPopupRefresh,
    } = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedRouters = this.getSortedRouters(
      routerNodes,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <>
        {routerNodes.length > 0 ? (
          <>
            <FancyScrollbar
              children={sortedRouters.map((r: RouterNode, i: number) => (
                <RouterTableRow
                  handleOnClickNodeName={handleOnClickNodeName}
                  handleRouterCheck={handleRouterCheck}
                  handleOnClickShellModalOpen={handleOnClickShellModalOpen}
                  onClickTableRow={onClickTableRow}
                  focusedNodeName={focusedNodeName}
                  isCheck={r.isCheck}
                  routerNode={r}
                  key={i}
                  oncueData={oncueData}
                />
              ))}
            />
            {isRouterDataPopupVisible ? (
              <DataPopup
                oncueData={oncueData}
                hanldeOnDismiss={hanldeOnDismiss}
                popupPosition={routerPopupPosition}
                handleOnClickProtocolModulesRow={
                  this.props.handleOnClickProtocolModulesRow
                }
                handleOnClickDeviceConnectionsRow={
                  this.props.handleOnClickDeviceConnectionsRow
                }
                routerDataPopupAutoRefresh={routerDataPopupAutoRefresh}
                onChooseRouterDataPopupAutoRefresh={
                  onChooseRouterDataPopupAutoRefresh
                }
                onManualRouterDataPopupRefresh={onManualRouterDataPopupRefresh}
              />
            ) : null}
          </>
        ) : (
          <NoHostsState />
        )}
      </>
    )
  }

  private filter(allNodes: RouterNode[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return allNodes.filter(h => {
      if (!h.nodeName) h.nodeName = '-'
      return h.nodeName.toLowerCase().includes(filterText)
    })
  }

  private sort(allNodes: RouterNode[], key: string, direction: SortDirection) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(allNodes, e => e[key])
      case SortDirection.DESC:
        const sortDesc = _.sortBy(
          allNodes,
          [e => e[key] || e[key] === 0 || e[key] === ''],
          ['asc']
        ).reverse()
        return sortDesc
      default:
        return allNodes
    }
  }

  private updateSearchTerm = (searchTerm: string) => {
    this.setState({searchTerm})
  }

  private updateSort = (key: string) => (): void => {
    const {sortKey, sortDirection} = this.state
    if (sortKey === key) {
      const reverseDirection =
        sortDirection === SortDirection.ASC
          ? SortDirection.DESC
          : SortDirection.ASC
      this.setState({sortDirection: reverseDirection})
    } else {
      this.setState({sortKey: key, sortDirection: SortDirection.ASC})
    }
  }
}

export default RouterTable
