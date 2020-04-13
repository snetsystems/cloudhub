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

class DeviceConnectionsTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {}
  }

  render() {
    return (
      <div>
        <strong>Device Connections</strong>
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
          style={{width: '100%'}}
        >
          URL
        </div>
      </>
    )
  }

  private get TableBody() {
    return (
      <div className="hosts-table--tr">
        <TableBodyRowItem
          title={'$protocol-module://192.168.1.10'}
          width={'100%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'$protocol-module://192.168.1.11'}
          width={'100%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'$protocol-module://192.168.1.12'}
          width={'100%'}
          className={'align--end'}
        />
      </div>
    )
  }
}

export default DeviceConnectionsTable
