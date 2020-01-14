import React, {PureComponent} from 'react'

import _ from 'lodash'
import memoize from 'memoize-one'

import SearchBar from 'src/hosts/components/SearchBar'
import TopSourcesTableRow from 'src/addon/128t/components/TopSourcesTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

import {TopSource} from 'src/addon/128t/types'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {TOPSOURCES_TABLE_SIZING} from 'src/addon/128t/constants'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export interface Props {
  topSources: TopSource[]
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  topSourceCount: string
  visible: boolean
}

@ErrorHandling
class TopSourcesTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'ip',
      topSourceCount: '0',
      visible: true,
    }
  }

  public getSortedTopSources = memoize(
    (
      topSources: TopSource[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) => this.sort(this.filter(topSources, searchTerm), sortKey, sortDirection)
  )

  public componentWillMount() {
    const {topSources} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    this.setSourceCount(topSources, searchTerm, sortKey, sortDirection)
  }

  public componentWillReceiveProps(nextProps: Props) {
    const {topSources} = this.props
    if (topSources === nextProps.topSources) return
    const {sortKey, sortDirection, searchTerm} = this.state

    this.setSourceCount(
      nextProps.topSources,
      searchTerm,
      sortKey,
      sortDirection
    )
  }

  private setSourceCount(
    topSources: TopSource[],
    searchTerm: string,
    sortKey: string,
    sortDirection: SortDirection
  ) {
    const sortedTopSources = this.getSortedTopSources(
      topSources,
      searchTerm,
      sortKey,
      sortDirection
    )
    this.setState({topSourceCount: sortedTopSources.length})
  }

  private onClickHandleVisible = () => {
    this.setState({visible: !this.state.visible})
  }

  public render() {
    const {topSourceCount, visible} = this.state
    return (
      <div className={`panel ${visible ? 'panel-height' : ''}`}>
        <div className="panel-heading">
          <button
            onClick={this.onClickHandleVisible}
            style={{
              flex: 'none',
              padding: '5px 10px',
              marginRight: '10px',
              width: '30px',
              background: 'none',
              border: '0 none',
              color: '#555',
            }}
          >
            {visible ? '▼' : '▲'}
          </button>
          <h2 className="panel-title">{topSourceCount} Top Sources</h2>
          <span
            className={'panel-heading-dividebar'}
            style={{
              display: 'block',
              height: '2px',
              backgroundColor: 'rgb(56,56,70)',
              flex: 'auto',
              margin: '0 15px',
            }}
          ></span>
          <div style={{flex: 'none'}}>
            <SearchBar
              placeholder="Filter by Tenant..."
              onSearch={this.updateSearchTerm}
            />
          </div>
        </div>
        {visible ? (
          <div className="panel-body">
            <div className="hosts-table">
              <div className="hosts-table--thead">
                <div className={'hosts-table--tr'}>{this.TableHeader}</div>
              </div>
              {this.TableData}
            </div>
          </div>
        ) : (
          ''
        )}
      </div>
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
          style={{width: IP}}
        >
          IP
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('tenant')}
          className={this.sortableClasses('tenant')}
          style={{width: TENANT}}
        >
          Tenant
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('totaldata')}
          className={this.sortableClasses('totaldata')}
          style={{width: TOTALDATA}}
        >
          Total Data
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('sessioncnt')}
          className={this.sortableClasses('sessioncnt')}
          style={{width: SESSIONCOUNT}}
        >
          Session count
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('bandwidth')}
          className={this.sortableClasses('bandwidth')}
          style={{width: CURRENTBANDWIDTH}}
        >
          Bandwidth
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  // data add
  private get TableData() {
    const {topSources} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    //const sortedTopSources = topSources
    const sortedTopSources = this.getSortedTopSources(
      topSources,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <FancyScrollbar
        children={sortedTopSources.map((r, i) => (
          <TopSourcesTableRow topSources={r} key={i} />
        ))}
      />
    )
  }

  public filter(alltopsources: TopSource[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return alltopsources.filter(h => {
      return h.tenant.toLowerCase().includes(filterText)
    })
  }

  public sort(alltopsources: TopSource[], key: string, direction: string) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(alltopsources, e => e[key])
      case SortDirection.DESC:
        return _.sortBy(alltopsources, e => e[key]).reverse()
      default:
        return alltopsources
    }
  }

  public updateSearchTerm = (searchTerm: string) => {
    this.setState({searchTerm})
  }

  public updateSort = (key: string) => () => {
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

export default TopSourcesTable
