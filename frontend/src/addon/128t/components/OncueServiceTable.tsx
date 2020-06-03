// Libraries
import React, {PureComponent} from 'react'

// Components
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import {
  Table,
  TableHeader,
  TableBody,
  TableBodyRowItem,
  usageIndacator,
  numberWithCommas,
} from 'src/addon/128t/reusable/layout'
import {NoHostsState} from 'src/addon/128t/reusable'

// Constants
import {ONCUE_SERVICE_TABLE_SIZING} from 'src/addon/128t/constants'

// type
import {OncueData} from 'src/addon/128t/types'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  oncueData: OncueData
  routerDataPopupAutoRefresh: number
  onChooseRouterDataPopupAutoRefresh: (milliseconds: number) => void
  onManualRouterDataPopupRefresh: () => void
}

@ErrorHandling
class OncueServiceTable extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  render() {
    const {
      oncueData,
      routerDataPopupAutoRefresh,
      onChooseRouterDataPopupAutoRefresh,
      onManualRouterDataPopupRefresh,
    } = this.props
    return (
      <div className={'data-table-container'}>
        <div className={'data-table-heading'}>
          <div className={'data-table-heading--left'}>
            <strong className="data-table-title">
              OncueService
              <span className="data-table-title-sub">{oncueData.nodeName}</span>
            </strong>
          </div>
          <div className={'data-table-heading--right'}>
            <AutoRefreshDropdown
              selected={routerDataPopupAutoRefresh}
              onChoose={onChooseRouterDataPopupAutoRefresh}
              onManualRefresh={onManualRouterDataPopupRefresh}
            />
          </div>
        </div>
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
        {oncueService !== null ? (
          <div className="hosts-table--tr">
            <TableBodyRowItem
              title={oncueService.name}
              width={ONCUE_SERVICE_NAME}
              className={'align--start'}
            />
            <TableBodyRowItem
              title={usageIndacator({value: oncueService.cpuUsage + ' %'})}
              width={ONCUE_SERVICE_CPU}
              className={'align--center'}
            />
            <TableBodyRowItem
              title={usageIndacator({value: oncueService.memoryUsage + ' %'})}
              width={ONCUE_SERVICE_MEMORY}
              className={'align--center'}
            />
            <TableBodyRowItem
              title={usageIndacator({value: oncueService.diskUsage + ' %'})}
              width={ONCUE_SERVICE_QUEUE}
              className={'align--center'}
            />
            <TableBodyRowItem
              title={oncueService.version}
              width={ONCUE_SERVICE_VERSION}
              className={'align--start'}
            />
            <TableBodyRowItem
              title={oncueService.status}
              width={ONCUE_SERVICE_STATUS}
              className={'align--start'}
            />
            <TableBodyRowItem
              title={oncueService.listeningPort}
              width={ONCUE_SERVICE_LISTENING_PORT}
              className={'align--start'}
            />
            <TableBodyRowItem
              title={numberWithCommas(oncueService.runningThread)}
              width={ONCUE_SERVICE_RUNNING_THREAD}
              className={'align--end'}
            />
            <TableBodyRowItem
              title={numberWithCommas(oncueService.processDataCount)}
              width={ONCUE_SERVICE_PROCESSING_DATA_COUNT}
              className={'align--end'}
            />
            <TableBodyRowItem
              title={numberWithCommas(oncueService.processSpeed)}
              width={ONCUE_SERVICE_PROCESSING_SPEED}
              className={'align--end'}
            />
          </div>
        ) : (
          <NoHostsState />
        )}
      </>
    )
  }
}

export default OncueServiceTable
