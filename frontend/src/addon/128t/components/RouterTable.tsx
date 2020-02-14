// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// Components
import GridLayoutSearchBar from 'src/addon/128t/components/GridLayoutSearchBar'
import RouterTableRow from 'src/addon/128t/components/RouterTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {NoHostsState, sortableClasses} from 'src/addon/128t/reusable'
import Dropdown from 'src/shared/components/Dropdown'
import LoadingSpinner from 'src/flux/components/LoadingSpinner'

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

//type
import {
  Router,
  TopSource,
  TopSession,
  SortDirection,
  SaltDirFile,
} from 'src/addon/128t/types'

// constants
import {ROUTER_TABLE_SIZING} from 'src/addon/128t/constants'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

export interface Props {
  cellBackgroundColor: string
  cellTextColor: string
  isEditable: boolean
  routers: Router[]
  isRoutersAllCheck: boolean
  focusedAssetId: string
  onClickTableRow: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => void
  handleOnChoose: ({selectItem: string}) => void
  handleRouterCheck: ({router: Router}) => void
  handleRoutersAllCheck: () => void
  handleFocusedBtnName: ({buttonName: string}) => void
  firmwares: SaltDirFile
  configs: SaltDirFile
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
}

@ErrorHandling
class RouterTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'assetId',
      routerCount: 0,
    }
  }

  public getSortedRouters = memoize(
    (
      routers: Router[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(routers, searchTerm), sortKey, sortDirection)
  )

  public componentWillMount() {
    const {routers} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedRouters: Router[] = this.getSortedRouters(
      routers,
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
    const {buttonName, isNew, items, handleFocusedBtnName, buttonStatus} = props
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
          onClick={() => {
            handleFocusedBtnName({buttonName})
          }}
        />
      </div>
    )
  }
  public extractionFilesName = (items: SaltDirItem[]): string[] => {
    return items.map(item => item.applicationFullName)
  }
  public render() {
    const {
      isEditable,
      cellTextColor,
      cellBackgroundColor,
      routers,
      handleOnChoose,
      firmwares,
      configs,
      handleFocusedBtnName,
    } = this.props

    return (
      <Panel>
        <PanelHeader isEditable={isEditable}>
          <CellName
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            value={routers}
            name={'Routers'}
          />
          <HeadingBar
            isEditable={isEditable}
            cellBackgroundColor={cellBackgroundColor}
          />
          <this.HeadingButton
            buttonName={'firmwares'}
            isNew={this.newChecker(firmwares.files)}
            handleOnChoose={handleOnChoose}
            handleFocusedBtnName={handleFocusedBtnName}
            items={this.extractionFilesName(firmwares.files)}
            buttonStatus={firmwares.isLoading}
          />
          <this.HeadingButton
            buttonName={'configs'}
            isNew={this.newChecker(configs.files)}
            handleFocusedBtnName={handleFocusedBtnName}
            items={this.extractionFilesName(configs.files)}
            buttonStatus={configs.isLoading}
          />
          <GridLayoutSearchBar
            placeholder="Filter by Asset ID..."
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

  private newChecker = (items: SaltDirItem[]): boolean => {
    if (items.length === 0) return
    const today = new Date().getTime()
    const oneDay = 86400000

    return items[0].updateGetTime + oneDay > today
  }

  private get TableHeader() {
    const {
      ASSETID,
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
          className={sortableClasses({sortKey, sortDirection, key: 'assetId'})}
          style={{width: CHECKBOX}}
        >
          <input
            type="checkbox"
            checked={isRoutersAllCheck}
            onClick={handleRoutersAllCheck}
            readOnly
          />
        </div>
        <div
          onClick={this.updateSort('assetId')}
          className={sortableClasses({sortKey, sortDirection, key: 'assetId'})}
          style={{width: ASSETID}}
        >
          Asset ID
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
      routers,
      focusedAssetId,
      onClickTableRow,
      handleRouterCheck,
    } = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedRouters = this.getSortedRouters(
      routers,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <>
        {routers.length > 0 ? (
          <FancyScrollbar
            children={sortedRouters.map((r: Router, i: number) => (
              <RouterTableRow
                handleRouterCheck={handleRouterCheck}
                onClickTableRow={onClickTableRow}
                focusedAssetId={focusedAssetId}
                isCheck={r.isCheck}
                router={r}
                key={i}
              />
            ))}
          />
        ) : (
          <NoHostsState />
        )}
      </>
    )
  }

  private filter(allrouters: Router[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return allrouters.filter(h => {
      return h.assetId.toLowerCase().includes(filterText)
    })
  }

  private sort(allrouters: Router[], key: string, direction: SortDirection) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(allrouters, e => e[key])
      case SortDirection.DESC:
        const sortDesc = _.sortBy(
          allrouters,
          [e => e[key] || e[key] === 0 || e[key] === ''],
          ['asc']
        ).reverse()
        return sortDesc
      default:
        return allrouters
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
