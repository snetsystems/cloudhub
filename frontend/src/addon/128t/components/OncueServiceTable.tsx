// Libraries
import React, {PureComponent} from 'react'

// Components
import {
  Table,
  TableHeader,
  TableBody,
  TableBodyRowItem,
  usageIndacator,
  numberWithCommas,
} from 'src/addon/128t/reusable/layout'

// Constants
import {ONCUE_SERVICE_TABLE_SIZING} from 'src/addon/128t/constants'

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
    const {
      ONCUE_SERVICE_NAME,
      ONCUE_SERVICE_CPU,
      ONCUE_SERVICE_MEMORY,
      ONCUE_SERVICE_QUEUE,
      ONCUE_SERVICE_VERSION,
      ONCUE_SERVICE_STATUS,
      ONCUE_SERVICE_LISTENING_PORT,
      ONCUE_SERVICE_RUNNING_THREAD,
      ONCUE_SERVICE_PROCESSING_DATA_COUNT,
      ONCUE_SERVICE_PROCESSING_SPEED,
    } = ONCUE_SERVICE_TABLE_SIZING
    return (
      <>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_NAME}}
        >
          Name
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_CPU}}
        >
          CPU
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_MEMORY}}
        >
          Memory
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_QUEUE}}
        >
          Queue
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_VERSION}}
        >
          Version
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_STATUS}}
        >
          Status
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_LISTENING_PORT}}
        >
          Listening Port
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_RUNNING_THREAD}}
        >
          Running Thread
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_PROCESSING_DATA_COUNT}}
        >
          Processing Data Count
        </div>
        <div
          className={'hosts-table--th sortable-header'}
          style={{width: ONCUE_SERVICE_PROCESSING_SPEED}}
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
      processingSpeed,
    } = oncueService

    const {
      ONCUE_SERVICE_NAME,
      ONCUE_SERVICE_CPU,
      ONCUE_SERVICE_MEMORY,
      ONCUE_SERVICE_QUEUE,
      ONCUE_SERVICE_VERSION,
      ONCUE_SERVICE_STATUS,
      ONCUE_SERVICE_LISTENING_PORT,
      ONCUE_SERVICE_RUNNING_THREAD,
      ONCUE_SERVICE_PROCESSING_DATA_COUNT,
      ONCUE_SERVICE_PROCESSING_SPEED,
    } = ONCUE_SERVICE_TABLE_SIZING

    return (
      <>
        <div className="hosts-table--tr">
          <TableBodyRowItem
            title={name}
            width={ONCUE_SERVICE_NAME}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={usageIndacator({value: cpu + ' %'})}
            width={ONCUE_SERVICE_CPU}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={usageIndacator({value: memory + ' %'})}
            width={ONCUE_SERVICE_MEMORY}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={usageIndacator({value: queue + ' %'})}
            width={ONCUE_SERVICE_QUEUE}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={version}
            width={ONCUE_SERVICE_VERSION}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={status}
            width={ONCUE_SERVICE_STATUS}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={listeningPort}
            width={ONCUE_SERVICE_LISTENING_PORT}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={numberWithCommas(runningThread)}
            width={ONCUE_SERVICE_RUNNING_THREAD}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={numberWithCommas(processingDataCount)}
            width={ONCUE_SERVICE_PROCESSING_DATA_COUNT}
            className={'align--end'}
          />
          <TableBodyRowItem
            title={numberWithCommas(processingSpeed)}
            width={ONCUE_SERVICE_PROCESSING_SPEED}
            className={'align--end'}
          />
        </div>
      </>
    )
  }
}

export default OncueServiceTable
