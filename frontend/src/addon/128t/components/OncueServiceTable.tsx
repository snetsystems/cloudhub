// Libraries
import React, {PureComponent} from 'react'

// Components
import {
  Table,
  TableHeader,
  TableBody,
  TableBodyRowItem,
  usageIndacator
} from 'src/addon/128t/reusable/layout'

// type
import {OncueData} from 'src/addon/128t/types'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  oncueData: OncueData
}

@ErrorHandling
class OncueServiceTable extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  render() {
    const {oncueData} = this.props
    return (
      <div className={'data-table-container'}>
        <strong className="data-table-title">
          OncueService
          <span className="data-table-title-sub">{oncueData.router}</span>
        </strong>
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
    const {oncueData} = this.props
    const {oncueService} = oncueData
    const {
      name,
      cpu,
      memory,
      queue,
      version,
      status,
      listeningPort,
      runningThread,
      processingDataCount,
      processingSpeed
    } = oncueService

    return (
      <>
        <div className="hosts-table--tr">
          <TableBodyRowItem
            title={name}
            width={'10%'}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={usageIndacator({value: cpu + ' %'})}
            width={'10%'}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={usageIndacator({value: memory + ' %'})}
            width={'10%'}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={usageIndacator({value: queue + ' %'})}
            width={'10%'}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={version}
            width={'10%'}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={status}
            width={'10%'}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={listeningPort}
            width={'10%'}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={runningThread}
            width={'10%'}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={processingDataCount}
            width={'10%'}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={processingSpeed}
            width={'10%'}
            className={'align--end'}
          />
        </div>
      </>
    )
  }
}

export default OncueServiceTable
