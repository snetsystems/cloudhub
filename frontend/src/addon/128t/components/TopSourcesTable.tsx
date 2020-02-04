// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// components
import GridLayoutSearchBar from 'src/addon/128t/components/GridLayoutSearchBar'
import TopSourcesTableRow from 'src/addon/128t/components/TopSourcesTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {NoHostsState, sortableClasses} from 'src/addon/128t/reusable'

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

// type
import {TopSource, SortDirection} from 'src/addon/128t/types'
import {ErrorHandling} from 'src/shared/decorators/errors'

// constants
import {TOPSOURCES_TABLE_SIZING} from 'src/addon/128t/constants'

export interface Props {
  topSources: TopSource[]
  isEditable: boolean
  cellBackgroundColor: string
  cellTextColor: string
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
  topSourceCount: number
}

@ErrorHandling
class TopSourcesTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'ip',
      topSourceCount: 0,
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
    const sortedTopSources: TopSource[] = this.getSortedTopSources(
      topSources,
      searchTerm,
      sortKey,
      sortDirection
    )
    this.setState({topSourceCount: sortedTopSources.length})
  }

  public render() {
    const {
      isEditable,
      cellTextColor,
      cellBackgroundColor,
      topSources,
    } = this.props
    return (
      <Panel>
        <PanelHeader isEditable={isEditable}>
          <CellName
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            value={topSources}
            name={'Top Sources'}
          />
          <HeadingBar
            isEditable={isEditable}
            cellBackgroundColor={cellBackgroundColor}
          />
          <GridLayoutSearchBar
            placeholder="Filter by Tenant..."
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

  private get TableHeader() {
    const {
      IP,
      TENANT,
      CURRENTBANDWIDTH,
      TOTALDATA,
      SESSIONCOUNT,
    } = TOPSOURCES_TABLE_SIZING
    const {sortKey, sortDirection} = this.state
    return (
      <>
        <div
          onClick={this.updateSort('ip')}
          className={sortableClasses({sortKey, sortDirection, key: 'ip'})}
          style={{width: IP}}
        >
          IP
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('tenant')}
          className={sortableClasses({sortKey, sortDirection, key: 'tenant'})}
          style={{width: TENANT}}
        >
          Tenant
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('sessionCount')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'sessionCount',
          })}
          style={{width: SESSIONCOUNT}}
          title="Session Count"
        >
          Session Count
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('currentBandwidth')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'currentBandwidth',
          })}
          style={{width: CURRENTBANDWIDTH}}
          title="Band Width"
        >
          Band Width
          <span className="icon caret-up" />
        </div>
        <div
          onClick={this.updateSort('totalData')}
          className={sortableClasses({
            sortKey,
            sortDirection,
            key: 'totalData',
          })}
          style={{width: TOTALDATA}}
          title="Total Data"
        >
          Total Data
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  private get TableData() {
    const {topSources} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state

    const sortedTopSources = this.getSortedTopSources(
      topSources,
      searchTerm,
      sortKey,
      sortDirection
    )

    return (
      <>
        {topSources.length > 0 ? (
          <FancyScrollbar
            children={sortedTopSources.map(
              (r: TopSource, i: number): JSX.Element => (
                <TopSourcesTableRow topSources={r} key={i} />
              )
            )}
          />
        ) : (
          <NoHostsState />
        )}
      </>
    )
  }

  private filter(alltopsources: TopSource[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return alltopsources.filter(h => {
      return h.tenant.toLowerCase().includes(filterText)
    })
  }

  private sort(alltopsources: TopSource[], key: string, direction: string) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(alltopsources, e => e[key])
      case SortDirection.DESC:
        return _.sortBy(alltopsources, e => e[key]).reverse()
      default:
        return alltopsources
    }
  }

  private updateSearchTerm = (searchTerm: string): void => {
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

export default TopSourcesTable
