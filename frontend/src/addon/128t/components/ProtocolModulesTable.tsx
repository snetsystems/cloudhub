import React, {PureComponent} from 'react'

import {NoHostsState, sortableClasses} from 'src/addon/128t/reusable'
import {
  Table,
  TableHeader,
  TableBody,
  TableBodyRowItem,
  sortableClasses
} from 'src/addon/128t/reusable/layout'

interface Props {}

interface State {}

class ProtocolModulesTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {}
  }

  render() {
    return (
      <div>
        <strong>Protocol Modules</strong>
        <Table>
          <TableHeader>{this.TableHeader}</TableHeader>
          <TableBody>{this.TableBody}</TableBody>
        </Table>
      </div>
    )
  }

  private get TableHeader() {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '34%'}}
        >
          Name
        </div>

        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '33%'}}
        >
          Version
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '33%'}}
        >
          Status
        </div>
      </>
    )
  }

  private get TableBody() {
    return (
      <div className="hosts-table--tr">
        <TableBodyRowItem
          title={'Service1'}
          width={'34%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'30.315'}
          width={'33%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'30.315'}
          width={'33%'}
          className={'align--end'}
        />
      </div>
    )
  }
}

export default ProtocolModulesTable
