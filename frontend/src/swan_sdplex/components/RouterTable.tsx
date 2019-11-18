import React, {PureComponent} from 'react'

import _ from 'lodash'
import memoize from 'memoize-one'

import SearchBar from 'src/hosts/components/SearchBar'
import RouterTableRow from 'src/swan_sdplex/components/RouterTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// import PageSpinner from 'src/shared/components/PageSpinner'

// import {AGENT_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

import {Router} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  routers: Router[]
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
          <h2 className="panel-title">title</h2>
          <SearchBar
            placeholder="Filter by Router..."
            onSearch={this.updateSearchTerm}
          />
        </div>
        <div className="panel-body">
          test--
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
    return (
      <>
        <div
          onClick={this.updateSort('assetId')}
          className={this.sortableClasses('assetId')}
          style={{width: '25%'}}
        >
          Asset ID
          <span className="icon caret-up" />
        </div>

        <div
          onClick={this.updateSort('routerstatus')}
          className={this.sortableClasses('routerstatus')}
          style={{width: '25%'}}
        >
          Router Status
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('networkstatus')}
          className={this.sortableClasses('networkstatus')}
          style={{width: '25%'}}
        >
          Network Status
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('applicationstatus')}
          className={this.sortableClasses('applicationstatus')}
          style={{width: '25%'}}
        >
          Application Status
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('cpu')}
          className={this.sortableClasses('cpu')}
          style={{width: '25%'}}
        >
          CPU
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('memory')}
          className={this.sortableClasses('memory')}
          style={{width: '25%'}}
        >
          Memory
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('sdplextraffic')}
          className={this.sortableClasses('sdplextraffic')}
          style={{width: '25%'}}
        >
          SDPlex traffic usage
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('config')}
          className={this.sortableClasses('config')}
          style={{width: '25%'}}
        >
          Config
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('firmware')}
          className={this.sortableClasses('firmware')}
          style={{width: '25%'}}
        >
          Firmware
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  // data add
  private get TableData() {
    const {routers} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    //const sortedRouters = routers
    const sortedRouters = this.getSortedRouters(
      routers,
      searchTerm,
      sortKey,
      sortDirection
    )

    let test = true
    if (test) {
      return (
        <FancyScrollbar
          children={sortedRouters.map((r, i) => (
            <RouterTableRow router={r} key={i} />
          ))}
        />
      )
    } else {
      return routers.map((r, i) => <RouterTableRow router={r} key={i} />)
    }
  }

  public filter(allrouters, searchTerm) {
    const filterText = searchTerm.toLowerCase()
    return allrouters.filter(h => {
      const apps = h.apps ? h.apps.join(', ') : ''

      let tagResult = false
      if (h.tags) {
        tagResult = Object.keys(h.tags).reduce((acc, key) => {
          return acc || h.tags[key].toLowerCase().includes(filterText)
        }, false)
      } else {
        tagResult = false
      }
      return (
        h.assetID.toLowerCase().includes(filterText) ||
        apps.toLowerCase().includes(filterText) ||
        tagResult
      )
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
