// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import memoize from 'memoize-one'

// Components
import ProtocolModulesTableRow from 'src/addon/128t/components/ProtocolModulesTableRow'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {NoHostsState, sortableClasses} from 'src/addon/128t/reusable'
import {Table, TableHeader, TableBody} from 'src/addon/128t/reusable/layout'

// Constants
import {PROTOCOL_MODULES_TABLE_SIZING} from 'src/addon/128t/constants'

// Type
import {SortDirection, ProtocolModule, OncueData} from 'src/addon/128t/types'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  oncueData: OncueData
  onClickRow: (name: string) => void
}

interface State {
  sortDirection: SortDirection
  sortKey: string
  searchTerm: string
}

@ErrorHandling
class ProtocolModulesTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortKey: 'name',
      sortDirection: SortDirection.ASC,
    }
  }

  public getSortedProtocolModules = memoize(
    (
      protocolModules: ProtocolModule[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ) =>
      this.sort(
        this.filter(protocolModules, searchTerm),
        sortKey,
        sortDirection
      )
  )

  render() {
    return (
      <div className={'data-table-container min-height'}>
        <strong className="data-table-title">Protocol Modules</strong>
        <Table>
          <TableHeader>{this.TableHeader}</TableHeader>
          <TableBody>{this.TableBody}</TableBody>
        </Table>
      </div>
    )
  }

  private get TableHeader() {
    const {sortKey, sortDirection} = this.state
    const {
      PROTOCOL_MODULES_NAME,
      PROTOCOL_MODULES_VERSION,
      PROTOCOL_MODULES_STATUS,
    } = PROTOCOL_MODULES_TABLE_SIZING

    return (
      <>
        <div
          className={sortableClasses({sortKey, sortDirection, key: 'name'})}
          onClick={this.updateSort('name')}
          style={{width: PROTOCOL_MODULES_NAME}}
        >
          Name
          <span className="icon caret-up" />
        </div>

        <div
          className={sortableClasses({sortKey, sortDirection, key: 'version'})}
          onClick={this.updateSort('version')}
          style={{width: PROTOCOL_MODULES_VERSION}}
        >
          Version
          <span className="icon caret-up" />
        </div>
        <div
          className={sortableClasses({sortKey, sortDirection, key: 'status'})}
          onClick={this.updateSort('status')}
          style={{width: PROTOCOL_MODULES_STATUS}}
        >
          Status
          <span className="icon caret-up" />
        </div>
      </>
    )
  }

  private get TableBody() {
    const {oncueData} = this.props
    const {protocolModules, focusedInProtocolModule} = oncueData
    const {searchTerm, sortKey, sortDirection} = this.state

    const sortedProtocolModules = this.getSortedProtocolModules(
      protocolModules,
      searchTerm,
      sortKey,
      sortDirection
    )
    return (
      <>
        {protocolModules.length > 0 ? (
          <FancyScrollbar
            children={sortedProtocolModules.map(
              (protocolModule: ProtocolModule): JSX.Element => (
                <ProtocolModulesTableRow
                  key={protocolModule.name}
                  protocolModule={protocolModule}
                  onClickRow={this.props.onClickRow}
                  focusedInProtocolModule={focusedInProtocolModule}
                />
              )
            )}
          />
        ) : (
          <NoHostsState />
        )}
      </>
    )
  }

  private filter(protocolModules: ProtocolModule[], searchTerm: string) {
    const filterText = searchTerm.toLowerCase()
    return protocolModules.filter(protocolModule => {
      return protocolModule.name.toLowerCase().includes(filterText)
    })
  }

  private sort(
    protocolModules: ProtocolModule[],
    key: string,
    direction: SortDirection
  ) {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy(protocolModules, e => e[key])
      case SortDirection.DESC:
        const sortDesc = _.sortBy(
          protocolModules,
          [e => e[key] || e[key] === 0 || e[key] === ''],
          ['asc']
        ).reverse()
        return sortDesc
      default:
        return protocolModules
    }
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

export default ProtocolModulesTable
