import React, { PureComponent } from 'react'

import _ from 'lodash'
import memoize from 'memoize-one'

import TopSourcesTableRow from 'src/addon/128t/components/TopSourcesTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

import { TopSources } from 'src/types'
import { ErrorHandling } from 'src/shared/decorators/errors'
import { TOPSOURCES_TABLE_SIZING } from 'src/addon/128t/constants/tableSizing'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  topSources: TopSources[]
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string

  topSourceCount: string
}

@ErrorHandling
class TopSourcesTable extends PureComponent<Props, State> {
  constructor(props) {
    super(props)
    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'ip',
      topSourceCount: '0',
    }
  }

  public getSortedTopSources = memoize(
    (
      topSources,
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(topSources, searchTerm), sortKey, sortDirection)
  )

  public render() {
    const { topSourceCount } = this.state
    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">{topSourceCount} Top Sources</h2>
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
      IP,
      TENANT,
      CURRENTBANDWIDTH,
      TOTALDATA,
      SESSIONCOUNT,
    } = TOPSOURCES_TABLE_SIZING
    return (
      <>
        <div
          onClick={this.updateSort('ip')}
          className={this.sortableClasses('ip')}
          style={{ width: IP }}
        >
          IP
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('tenant')}
          className={this.sortableClasses('tenant')}
          style={{ width: TENANT }}
        >
          Tenant
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('bandwidth')}
          className={this.sortableClasses('bandwidth')}
          style={{ width: CURRENTBANDWIDTH }}
        >
          Current bandwidth
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('totaldata')}
          className={this.sortableClasses('totaldata')}
          style={{ width: TOTALDATA }}
        >
          Total Data
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('sessioncnt')}
          className={this.sortableClasses('sessioncnt')}
          style={{ width: SESSIONCOUNT }}
        >
          Session count
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  // data add
  private get TableData() {
    const { topSources } = this.props
    const { sortKey, sortDirection, searchTerm } = this.state

    //const sortedTopSources = topSources
    const sortedTopSources = this.getSortedTopSources(
      topSources,
      searchTerm,
      sortKey,
      sortDirection
    )
    this.setState({ topSourceCount: sortedTopSources.length })
    return (
      <FancyScrollbar
        children={sortedTopSources.map((r, i) => (
          <TopSourcesTableRow topSources={r} key={i} />
        ))}
      />
    )
  }

  public filter(alltopsources, searchTerm) {
    const filterText = searchTerm.toLowerCase()
    return alltopsources.filter(h => {
      let tagResult = false
      if (h.tags) {
        tagResult = Object.keys(h.tags).reduce((acc, key) => {
          return acc || h.tags[key].toLowerCase().includes(filterText)
        }, false)
      } else {
        tagResult = false
      }
      return h.ip.toLowerCase().includes(filterText) || tagResult
    })
  }

  public sort(alltopsources, key, direction) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(alltopsources, e => e[key])
      case SortDirection.DESC:
        return _.sortBy(alltopsources, e => e[key]).reverse()
      default:
        return alltopsources
    }
  }

  public updateSearchTerm = searchTerm => {
    this.setState({ searchTerm })
  }

  public updateSort = key => () => {
    const { sortKey, sortDirection } = this.state
    if (sortKey === key) {
      const reverseDirection =
        sortDirection === SortDirection.ASC
          ? SortDirection.DESC
          : SortDirection.ASC
      this.setState({ sortDirection: reverseDirection })
    } else {
      this.setState({ sortKey: key, sortDirection: SortDirection.ASC })
    }
  }

  public sortableClasses = (key: string): string => {
    const { sortKey, sortDirection } = this.state
    if (sortKey === key) {
      if (sortDirection === SortDirection.ASC) {
        return 'hosts-table--th sortable-header sorting-ascending'
      }
      return 'hosts-table--th sortable-header sorting-descending'
    }
    return 'hosts-table--th sortable-header'
  }
}

export default TopSourcesTable
