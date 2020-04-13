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

class OncueServiceTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {}
  }

  render() {
    return (
      <div>
        <strong>OncueServiceTable</strong>
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
          style={{width: '10%'}}
        >
          Name
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          CPU
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Memory
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Queue
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Version
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Status
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Listening Port
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Running Thread
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Processing Data Count
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: '10%'}}
        >
          Processing Speed
        </div>
      </>
    )
  }

  private get TableBody() {
    return (
      <div className="hosts-table--tr">
        <TableBodyRowItem
          title={'Service1'}
          width={'10%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'30.315'}
          width={'10%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'50.55%'}
          width={'10%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'60.5%'}
          width={'10%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'1.1.2'}
          width={'10%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'Running'}
          width={'10%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'9090'}
          width={'10%'}
          className={'align--end'}
        />
        <TableBodyRowItem title={'10'} width={'10%'} className={'align--end'} />
        <TableBodyRowItem
          title={'100,000'}
          width={'10%'}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={'1,000'}
          width={'10%'}
          className={'align--end'}
        />
      </div>
    )
  }
}

export default OncueServiceTable
