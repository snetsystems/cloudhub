// libraries
import _ from 'lodash'
import memoize from 'memoize-one'
import React, {Fragment, PureComponent} from 'react'

// component
import {TableBodyRowItem} from 'src/addon/128t/reusable'
import SearchBar from 'src/hosts/components/SearchBar'

// types
import {SecurityGroupRule} from 'src/clouds/types/openstack'

enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

interface Props {
  securityGroupRules: SecurityGroupRule[]
}

interface State {
  searchTerm: string
  sortDirection: SortDirection
  sortKey: string
}

class OpenStackSecurityGroupTable extends PureComponent<Props, State> {
  public getSortedSecurityGroups = memoize(
    (
      securityGroupRules: SecurityGroupRule[],
      searchTerm: string,
      sortKey: string,
      sortDirection: SortDirection
    ): SecurityGroupRule[] => {
      return this.sort(
        this.filter(securityGroupRules, searchTerm),
        sortKey,
        sortDirection
      )
    }
  )

  constructor(props: Props) {
    super(props)

    this.state = {
      searchTerm: '',
      sortDirection: SortDirection.ASC,
      sortKey: 'securityGroup',
    }
  }

  public filter(securityGroupRules, searchTerm: string): SecurityGroupRule[] {
    const filterText = searchTerm.toLowerCase()
    return _.filter(securityGroupRules, (h: SecurityGroupRule) => {
      return (
        h.securityGroup.toLowerCase().includes(filterText) ||
        _.toString(h.ethertype).toLowerCase().includes(filterText) ||
        _.toString(h.protocol).toLowerCase().includes(filterText) ||
        _.toString(h.remoteIPPrefix).toLowerCase().includes(filterText) ||
        _.toString(h.portrange).toLowerCase().includes(filterText) ||
        _.toString(h.remoteSecurityGroup).toLowerCase().includes(filterText)
      )
    })
  }

  public sort(
    securityGroupRules: SecurityGroupRule[],
    key: string,
    direction: SortDirection
  ): SecurityGroupRule[] {
    switch (direction) {
      case SortDirection.ASC:
        return _.sortBy<SecurityGroupRule>(securityGroupRules, e => {
          return e[key]
        })
      case SortDirection.DESC:
        return _.sortBy<SecurityGroupRule>(
          securityGroupRules,
          e => e[key]
        ).reverse()
      default:
        return securityGroupRules
    }
  }

  public updateSearchTerm = (searchTerm: string): void => {
    this.setState({searchTerm})
  }

  public updateSort = (key: string) => (): void => {
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

  private get TableHeader() {
    return (
      <>
        <div className="hosts-table--thead">
          <div className="hosts-table--tr">
            <div
              onClick={this.updateSort('securityGroup')}
              className={this.sortableClasses('securityGroup')}
              style={{
                width: '20%',
              }}
            >
              Security Group
              <span className="icon caret-up" />
            </div>
            <div
              onClick={this.updateSort('ethertype')}
              className={this.sortableClasses('ethertype')}
              style={{
                width: '10%',
              }}
            >
              Ether Type
              <span className="icon caret-up" />
            </div>

            <div
              onClick={this.updateSort('protocol')}
              className={this.sortableClasses('protocol')}
              style={{
                width: '10%',
              }}
            >
              IP Protocol
              <span className="icon caret-up" />
            </div>
            <div
              onClick={this.updateSort('portrange')}
              className={this.sortableClasses('portrange')}
              style={{
                width: '18%',
              }}
            >
              Port Range
              <span className="icon caret-up" />
            </div>
            <div
              onClick={this.updateSort('remoteIPPrefix')}
              className={this.sortableClasses('remoteIPPrefix')}
              style={{
                width: '22%',
              }}
            >
              Remote IP Prefix
              <span className="icon caret-up" />
            </div>
            <div
              onClick={this.updateSort('remoteSecurityGroup')}
              className={this.sortableClasses('remoteSecurityGroup')}
              style={{
                width: '20%',
              }}
            >
              Remote Security Group
              <span className="icon caret-up" />
            </div>
          </div>
        </div>
      </>
    )
  }

  public makeTableRow(securityGroupRule: SecurityGroupRule): JSX.Element {
    return (
      <>
        <div className={'hosts-table--tr'} style={{justifyContent: 'center'}}>
          <TableBodyRowItem
            title={securityGroupRule.securityGroup}
            width={'20%'}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={securityGroupRule.ethertype}
            width={'10%'}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={
              securityGroupRule.protocol === null
                ? 'All'
                : securityGroupRule.protocol.toUpperCase()
            }
            width={'10%'}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={securityGroupRule.portrange}
            width={'18%'}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={securityGroupRule.remoteIPPrefix}
            width={'22%'}
            className={'align--center'}
          />
          <TableBodyRowItem
            title={securityGroupRule.remoteSecurityGroup}
            width={'20%'}
            className={'align--center'}
          />
        </div>
      </>
    )
  }

  public render() {
    return (
      <div style={{width: '100%'}}>
        <div style={{margin: '10px 0'}}>
          <SearchBar
            placeholder="Filter by text search..."
            onSearch={this.updateSearchTerm}
          />
        </div>
        <div>{this.TableWithSecurityGroups}</div>
      </div>
    )
  }

  private get TableWithSecurityGroups(): JSX.Element {
    const {securityGroupRules} = this.props
    const {sortKey, sortDirection, searchTerm} = this.state
    const sortedGroups = this.getSortedSecurityGroups(
      securityGroupRules,
      searchTerm,
      sortKey,
      sortDirection
    ) as SecurityGroupRule[]

    return (
      <div className="hosts-table">
        {this.TableHeader}
        <div className={`hosts-table--tbody`}>
          {sortedGroups.map(
            (securityGroupRule): JSX.Element => {
              return (
                <Fragment key={securityGroupRule.id}>
                  {this.makeTableRow(securityGroupRule)}
                </Fragment>
              )
            }
          )}
        </div>
      </div>
    )
  }
}

export default OpenStackSecurityGroupTable
