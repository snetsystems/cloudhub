import React from 'react'
import _ from 'lodash'

import {
  CellName,
  HeadingBar,
  PanelHeader,
  Panel,
  PanelBody,
  Table,
  TableHeader,
  TableBody,
  TableBodyRowItem,
} from 'src/addon/128t/reusable/layout'
import {convertUnit} from 'src/shared/components/ProgressDisplay'
import {responseIndicator} from 'src/shared/components/Indicator'
import {NoState} from 'src/agent_admin/reusable'
import Tooltip from 'src/shared/components/Tooltip'

// constants
import {VCENTER_VM_TABLE_SIZING} from 'src/hosts/constants/tableSizing'

// types
import {VM} from 'src/hosts/types'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
interface Props {
  isEditable: boolean
  cellTextColor: string
  cellBackgroundColor: string
  item: VM
  selectMinion: string
  saltMasterUrl: string
  saltMasterToken: string
  handleGetTicketRemoteConsoleAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minionId: string,
    address: string,
    user: string,
    password: string
  ) => Promise<String[]>
  handleGetVSphereAsync: (id: string) => Promise<any>
}

const VirtualMachineTable = (props: Props): JSX.Element => {
  const {
    isEditable,
    cellTextColor,
    cellBackgroundColor,
    item,
    selectMinion,
    handleGetTicketRemoteConsoleAsync,
    handleGetVSphereAsync,
    saltMasterUrl,
    saltMasterToken,
  } = props

  const {
    CPUWidth,
    MemoryWidth,
    StorageWidth,
    IPWidth,
    OSWidth,
    StatusWidth,
  } = VCENTER_VM_TABLE_SIZING

  const remoteConsoleRun = async () => {
    const vsphereInfo = await handleGetVSphereAsync(item.id)
    const ticket = await handleGetTicketRemoteConsoleAsync(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      _.get(vsphereInfo, 'host', ''),
      _.get(vsphereInfo, 'username', ''),
      _.get(vsphereInfo, 'password', '')
    )

    if (!ticket) {
      return
    }

    let url =
      'vmrc://clone:' +
      ticket +
      '@' +
      _.get(vsphereInfo, 'host', '') +
      '/?moid=' +
      item.moid

    window.location.href = url
  }

  const remoteConsoleDownloadOpen = () => {
    console.log('remoteConsoleDownloadOpen')
    window.open('https://vmware.com/go/download-vmrc', '_blank')
  }

  const Header = (): JSX.Element => {
    return (
      <>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: CPUWidth}}
        >
          CPU
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: MemoryWidth}}
        >
          Memory
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: StorageWidth}}
        >
          Storage
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: IPWidth}}
        >
          IP
        </div>
        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: OSWidth}}
        >
          OS
        </div>

        <div
          className={'hosts-table--th sortable-header align--center'}
          style={{width: StatusWidth}}
        >
          Power Status
        </div>
      </>
    )
  }

  const Body = (): JSX.Element => {
    const {
      cpu_usage,
      memory_usage,
      os,
      storage_usage,
      power_state,
      ip_address,
    } = item

    return (
      <div className="hosts-table--tr">
        <TableBodyRowItem
          title={convertUnit('CPU', cpu_usage)}
          width={CPUWidth}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={convertUnit('Memory', memory_usage)}
          width={MemoryWidth}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={convertUnit('Storage', storage_usage)}
          width={StorageWidth}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={ip_address}
          width={IPWidth}
          className={'align--start'}
        />
        <TableBodyRowItem
          title={os}
          width={OSWidth}
          className={'align--start'}
        />

        <TableBodyRowItem
          title={responseIndicator(power_state === 'poweredOn')}
          width={StatusWidth}
          className={'align--center'}
        />
      </div>
    )
  }

  return (
    <FancyScrollbar className="getting-started--container">
      <Panel>
        <PanelHeader isEditable={isEditable}>
          <CellName
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            value={[]}
            name={`Virtual Machine - ${item ? item.name : ''}`}
            sizeVisible={false}
          />
          <HeadingBar
            isEditable={isEditable}
            cellBackgroundColor={cellBackgroundColor}
          />
          <div
            className={`heading--button-box`}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignContent: 'center',
              marginRight: '10px',
            }}
          >
            <Tooltip
              tip={'Open Console'}
              children={
                <button
                  className={`button button-sm button-default button-square`}
                  style={{
                    width: '25px',
                    height: '25px',
                    marginRight: '5px',
                  }}
                  onClick={remoteConsoleRun}
                >
                  <span
                    className={`icon-vmrc`}
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignContent: 'center',
                    }}
                  ></span>
                </button>
              }
            />
            <Tooltip
              tip={'Download console'}
              children={
                <button
                  className={`button button-sm button-default button-square`}
                  style={{
                    width: ' 25px',
                    height: '25px',
                  }}
                  onClick={remoteConsoleDownloadOpen}
                >
                  <span
                    className={`button-icon icon download`}
                    style={{
                      fontSize: '12px',
                      lineHeight: '0px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignContent: 'center',
                    }}
                  ></span>
                </button>
              }
            />
          </div>
        </PanelHeader>
        <PanelBody>
          <>
            <Table>
              <TableHeader>
                <Header />
              </TableHeader>
              <TableBody>
                {item ? (
                  <Body />
                ) : (
                  <NoState message={`There is no Virtual Machine`} />
                )}
              </TableBody>
            </Table>
          </>
        </PanelBody>
      </Panel>
    </FancyScrollbar>
  )
}

export default VirtualMachineTable
