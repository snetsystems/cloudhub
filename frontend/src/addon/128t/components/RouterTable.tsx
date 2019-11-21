import React, {PureComponent} from 'react'

import _ from 'lodash'
import memoize from 'memoize-one'

import SearchBar from 'src/hosts/components/SearchBar'
import RouterTableRow from 'src/addon/128t/components/RouterTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

import {Router} from 'src/types'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {ROUTER_TABLE_SIZING} from 'src/addon/128t/constants/tableSizing'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  routers: Router[]
  onClickModal: ({name, _this, onClickfn}) => JSX.Element
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

@ErrorHandling
class RouterTable extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'assetId',
    }
  }

  public getSortedRouters = memoize(
    (
      routers,
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(routers, searchTerm), sortKey, sortDirection)
  )

  public render() {
    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">Routers</h2>
          <SearchBar
            placeholder="Filter by Router..."
            onSearch={this.updateSearchTerm}
          />
        </div>
        <div className="panel-body">
          <div className="hosts-table">
            <div className="hosts-table--thead">
              <div className="hosts-table--tr">{this.TableHeader}</div>
            </div>
            {this.TableData}
          </div>
        </div>
      </div>
      // </div>
    )
  }

  private get TableHeader() {
    const {
      ASSETID,
      ROUTERSTATUS,
      NETWORKSTATUS,
      APPLICATIONSTATUS,
      CPU,
      MEMORY,
      SDPLEXTRAFFICUSAGE,
      CONFIG,
      FIRMWARE,
    } = ROUTER_TABLE_SIZING
    return (
      <>
        <div
          onClick={this.updateSort('assetId')}
          className={this.sortableClasses('assetId')}
          style={{width: ASSETID}}
        >
          Asset ID
          <span className="icon caret-up" />
        </div>

        <div
          onClick={this.updateSort('routerstatus')}
          className={this.sortableClasses('routerstatus')}
          style={{width: ROUTERSTATUS}}
        >
          Router Status
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('networkstatus')}
          className={this.sortableClasses('networkstatus')}
          style={{width: NETWORKSTATUS}}
        >
          Network Status
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('applicationstatus')}
          className={this.sortableClasses('applicationstatus')}
          style={{width: APPLICATIONSTATUS}}
        >
          Application Status
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('cpu')}
          className={this.sortableClasses('cpu')}
          style={{width: CPU}}
        >
          CPU
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('memory')}
          className={this.sortableClasses('memory')}
          style={{width: MEMORY}}
        >
          Memory
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('sdplextraffic')}
          className={this.sortableClasses('sdplextraffic')}
          style={{width: SDPLEXTRAFFICUSAGE}}
        >
          SDPlex traffic usage
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('config')}
          className={this.sortableClasses('config')}
          style={{width: CONFIG}}
        >
          Config
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('firmware')}
          className={this.sortableClasses('firmware')}
          style={{width: FIRMWARE}}
        >
          Firmware
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  // data add
  private get TableData() {
    const {routers, onClickModal} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    //const sortedRouters = routers
    const sortedRouters = this.getSortedRouters(
      routers,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <FancyScrollbar
        children={sortedRouters.map((r, i) => (
          <RouterTableRow onClickModal={onClickModal} router={r} key={i} />
        ))}
      />
    )
  }

  public filter(allrouters, searchTerm) {
    const filterText = searchTerm.toLowerCase()
    return allrouters.filter(h => {
      let tagResult = false
      if (h.tags) {
        tagResult = Object.keys(h.tags).reduce((acc, key) => {
          return acc || h.tags[key].toLowerCase().includes(filterText)
        }, false)
      } else {
        tagResult = false
      }
      return h.assetID.toLowerCase().includes(filterText) || tagResult
    })
  }

  public sort(allrouters, key, direction) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(allrouters, e => e[key])
      case SortDirection.DESC:
        return _.sortBy(allrouters, e => e[key]).reverse()
      default:
        return allrouters
    }
  }

  public updateSearchTerm = searchTerm => {
    this.setState({searchTerm})
  }

  public updateSort = key => () => {
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

  public sortableClasses = (key: string): string => {
    const {sortKey, sortDirection} = this.state
    if (sortKey === key) {
      if (sortDirection === SortDirection.ASC) {
        return 'hosts-table--th sortable-header sorting-ascending'
      }
      return 'hosts-table--th sortable-header sorting-descending'
    }
    return 'hosts-table--th sortable-header'
  }
}

export default RouterTable
