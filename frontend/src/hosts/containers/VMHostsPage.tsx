// Library
import React, {useState, useEffect, ChangeEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {ComponentStatus} from 'src/reusable_ui/types'

// Component
import {Button, ComponentSize, Form, Input, InputType} from 'src/reusable_ui'

import {cellLayoutInfo} from 'src/addon/128t/containers/SwanSdplexStatusPage'
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import TreeMenu from 'src/reusable_ui/components/treemenu'
import ChartsLayoutRenderer from 'src/hosts/components/ChartsLayoutRenderer'
import HostModal from 'src/hosts/components/HostModal'
import Dropdown from 'src/shared/components/Dropdown'

import VcenterTable from 'src/hosts/components/VcenterTable'
import DatacentersTable from 'src/hosts/components/DatacentersTable'
import DatacenterTable from 'src/hosts/components/DatacenterTable'
import DatastoresTable from 'src/hosts/components/DatastoresTable'
import ClustersTable from 'src/hosts/components/ClustersTable'
import ClusterTable from 'src/hosts/components/ClusterTable'
import VMHostsTable from 'src/hosts/components/VMHostsTable'
import VMHostTable from 'src/hosts/components/VMHostTable'
import VirtualMachinesTable from 'src/hosts/components/VirtualMachinesTable'
import VirtualMachineTable from 'src/hosts/components/VirtualMachineTable'

// Type
import {TimeRange, Cell, Template, Source} from 'src/types'
import {Item} from 'src/reusable_ui/components/treemenu/TreeMenu/walk'
import {AddonType} from 'src/shared/constants'
import {Addon} from 'src/types/auth'

// Actions
import {getMinionKeyAcceptedListAsync} from 'src/hosts/actions'

// Constants
import {
  STATUS_PAGE_ROW_COUNT,
  PAGE_HEADER_HEIGHT,
  PAGE_CONTAINER_MARGIN,
  LAYOUT_MARGIN,
  HANDLE_VERTICAL,
} from 'src/shared/constants'

import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

// ErrorHandler
// import {ErrorHandling} from 'src/shared/decorators/errors'

const GridLayout = WidthProvider(ReactGridLayout)
const MINION_LIST_EMPTY = '<< Empty >>'

interface ConnectionFormProps {
  target: string
  address: string
  port: string
  user: string
  password: string
  protocol: string
  interval: string
  targetItems: string[]
  intervalItems: string[]
  handleChangeTarget: (e) => void
  handleChangeAddress: (e) => void
  handleChangePort: (e) => void
  handleChangeUser: (e) => void
  handleChangePassword: (e) => void
  handleChangeProtocol: (e) => void
  handleChangeInterval: (e) => void
}
const ConnectForm = ({
  target,
  address,
  port,
  user,
  password,
  protocol,
  interval,
  targetItems,
  intervalItems,
  handleChangeTarget,
  handleChangeAddress,
  handleChangePort,
  handleChangeUser,
  handleChangePassword,
  handleChangeProtocol,
  handleChangeInterval,
}: ConnectionFormProps) => {
  return (
    <Form>
      <Form.Element label="Using Minion" colsXS={12}>
        <Dropdown
          value={'minionasd'}
          items={targetItems}
          onChoose={handleChangeTarget}
          selected={target}
          className="dropdown-stretch"
          disabled={false}
        />
      </Form.Element>
      <Form.Element label="Connection vCenter" colsXS={8}>
        <Input
          value={address}
          onChange={handleChangeAddress}
          placeholder={'Connect Address'}
          type={InputType.Text}
        />
      </Form.Element>
      <Form.Element label="Port" colsXS={4}>
        <Input
          value={port}
          onChange={handleChangePort}
          placeholder={'Connect Port'}
          type={InputType.Text}
        />
      </Form.Element>

      <Form.Element label="ID" colsXS={6}>
        <Input
          value={user}
          onChange={handleChangeUser}
          placeholder={'Connect ID'}
          type={InputType.Text}
        />
      </Form.Element>
      <Form.Element label="Password" colsXS={6}>
        <Input
          value={password}
          onChange={handleChangePassword}
          placeholder={'Connect Password'}
          type={InputType.Password}
        />
      </Form.Element>
      <Form.Element label="Protocol" colsXS={6}>
        <Input
          value={protocol}
          onChange={handleChangeProtocol}
          placeholder={'Default https'}
          type={InputType.Text}
        />
      </Form.Element>
      <Form.Element label="Interval" colsXS={6}>
        <Dropdown
          items={intervalItems}
          onChoose={handleChangeInterval}
          selected={interval}
          className="dropdown-stretch"
          disabled={false}
        />
      </Form.Element>
    </Form>
  )
}
interface Props {
  addons: Addon[]
  handleGetMinionKeyAcceptedList: (
    saltMasterUrl: string,
    saltMasterToken: string
  ) => Promise<String[]>
}

interface VM extends Item {
  type?: string
}

const VMHostsPage = (props: Props): JSX.Element => {
  const {addons, handleGetMinionKeyAcceptedList} = props
  const intervalItems = ['30s', '1m', '5m']

  const [proportions, setProportions] = useState([0.25, 0.75])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [target, setTarget] = useState(MINION_LIST_EMPTY)
  const [address, setAddress] = useState('')
  const [port, setPort] = useState('443')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [protocol, setProtocol] = useState('https')
  const [interval, setInterval] = useState('1m')
  const [focusedHost, setFocusedHost] = useState<VM>({
    hasNodes: false,
    isOpen: false,
    level: 0,
    key: '',
    label: '',
    name: '',
  })
  const [layout, setLayout] = useState([])
  const [vCenters, setVCenters] = useState({})
  const [acceptedMinionList, setAcceptedMinionList] = useState([])

  const handleChangeTarget = (e: {text: string}): void => {
    setTarget(e.text)
  }

  const handleChangeAddress = (e: ChangeEvent<HTMLInputElement>): void => {
    setAddress(e.target.value)
  }

  const handleChangePort = (e: ChangeEvent<HTMLInputElement>): void => {
    setPort(e.target.value)
  }

  const handleChangeUser = (e: ChangeEvent<HTMLInputElement>): void => {
    setUser(e.target.value)
  }

  const handleChangePassword = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value)
  }

  const handleChangeProtocol = (e: ChangeEvent<HTMLInputElement>): void => {
    setProtocol(e.target.value)
  }

  const handleChangeInterval = (e: {text: string}): void => {
    setInterval(e.text)
  }

  const handleClose = (): void => {
    setIsModalVisible(false)
  }

  const handleOpen = async (): Promise<void> => {
    const addon = addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    const minionList: any = await handleGetMinionKeyAcceptedList(
      saltMasterUrl,
      saltMasterToken
    )

    if (minionList.length > 0) {
      setTarget(minionList[0])
    }
    setAcceptedMinionList(minionList)
    setIsModalVisible(true)
  }

  const handleConnection = (): void => {
    console.log(target, address, user, password, port, protocol, interval)
    AddVCenter([target])
    handleClose()
  }

  useEffect(() => {
    switch (focusedHost.type) {
      case 'vcenter': {
        return setLayout([
          {
            i: 'vcenter',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'charts',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'datacenters',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
        ])
      }
      case 'datacenter': {
        return setLayout([
          {
            i: 'datacenter',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'charts',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'clusters',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'vmhosts',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'datastores',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
        ])
      }
      case 'cluster': {
        return setLayout([
          {
            i: 'cluster',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'vmhosts',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'datastores',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
        ])
      }
      case 'host': {
        return setLayout([
          {
            i: 'vmhost',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'charts',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
          {
            i: 'vms',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
        ])
      }
      case 'vm': {
        return setLayout([
          {
            i: 'vm',
            x: 0,
            y: 0,
            w: 12,
            h: 2,
          },
          {
            i: 'charts',
            x: 0,
            y: 0,
            w: 12,
            h: 3,
          },
        ])
      }
      default: {
        return
      }
    }
  }, [focusedHost])

  const cellBackgroundColor: string = DEFAULT_CELL_BG_COLOR
  const cellTextColor: string = DEFAULT_CELL_TEXT_COLOR

  const cellstyle = {
    backgroundColor: cellBackgroundColor,
    borderColor: cellBackgroundColor,
  }

  const calculateRowHeight = (): number => {
    return (
      (window.innerHeight -
        STATUS_PAGE_ROW_COUNT * LAYOUT_MARGIN -
        PAGE_HEADER_HEIGHT -
        PAGE_CONTAINER_MARGIN -
        PAGE_CONTAINER_MARGIN) /
      STATUS_PAGE_ROW_COUNT
    )
  }

  const WindowResizeEventTrigger = function() {
    const event = document.createEvent('HTMLEvents')
    event.initEvent('resize', true, false)
    window.dispatchEvent(event)
  }

  const debouncedFit = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 250)

  const handleResize = (proportions: number[]) => {
    setProportions(proportions)
    debouncedFit()
  }

  const handleLayoutChange = (cellsLayout: cellLayoutInfo[]): void => {
    // if (!this.props.onPositionChange) return
    // let changed = false
    // const newCellsLayout = this.props.layout.map(lo => {
    //   const l = cellsLayout.find(cellLayout => cellLayout.i === lo.i)
    //   if (lo.x !== l.x || lo.y !== l.y || lo.h !== l.h || lo.w !== l.w) {
    //     changed = true
    //   }
    //   const newLayout = {
    //     x: l.x,
    //     y: l.y,
    //     h: l.h,
    //     w: l.w,
    //   }
    //   return {
    //     ...lo,
    //     ...newLayout,
    //   }
    // })
    // if (changed) {
    //   this.props.onPositionChange(newCellsLayout)
    // }
  }

  const getVCenterInfo = minionId => {
    let vCenterData
    if (minionId === 'minion06') {
      vCenterData = require('./dummy.json')
    } else if (minionId === 'minion03') {
      vCenterData = require('./dummy2.json')
    }
    // else {
    //   vCenterData = require('./dummy3.json')
    // }

    if (!vCenterData) {
      return
    }

    let vcCpuUsage = []
    let vcCpuSpace = []
    let vcMemoryUsage = []
    let vcMemorySpace = []
    let vcStorgeUsage = []
    let vcStorgeSpace = []
    let vcStorgeCapacity = []
    let vcClustersCount = []
    let vcHostCount = []
    let vcVmCount = []
    let vcDatacenters = []
    let minionName = Object.keys(vCenterData.return[0])
    let vcMinionValue: any[] = Object.values(vCenterData.return[0])
    let vcIpAddress = vcMinionValue[0].vcenter

    let vcenter = [vCenterData].reduce(
      acc => {
        const datacenters = vcMinionValue[0].datacenters
        datacenters.reduce((acc, datacenter, i) => {
          vcDatacenters.push(datacenter)
          vcCpuUsage.push(datacenter.cpu_usage)
          vcCpuSpace.push(datacenter.cpu_space)
          vcMemoryUsage.push(datacenter.memory_usage)
          vcMemorySpace.push(datacenter.memory_space)
          vcStorgeUsage.push(datacenter.storage_usage)
          vcStorgeSpace.push(datacenter.storage_space)
          vcStorgeCapacity.push(datacenter.storage_capacity)
          vcClustersCount.push(datacenter.cluster_count)
          vcHostCount.push(datacenter.host_count)
          vcVmCount.push(datacenter.vm_count)

          let datacenterHosts = []
          const datacenterName = datacenter.name
          acc[vcIpAddress]['nodes'][datacenterName] = {
            label: datacenterName,
            index: i,
            level: 1,
            type: 'datacenter',
            minion: minionName[0],
            nodes: {},
            datacenter_hosts: datacenterHosts,
            ...datacenter,
          }

          const clusters = datacenter.clusters
          clusters.reduce((acc, cluster, i) => {
            const clusterName = cluster.name
            acc[vcIpAddress]['nodes'][datacenterName]['nodes'][clusterName] = {
              label: clusterName,
              index: i,
              level: 2,
              type: 'cluster',
              minion: minionName[0],
              nodes: {},
              ...cluster,
            }

            const hosts = cluster.hosts
            hosts.reduce((acc, host, i) => {
              const hostName = host.name
              acc[vcIpAddress]['nodes'][datacenterName]['nodes'][clusterName][
                'nodes'
              ][hostName] = {
                label: hostName,
                index: i,
                level: 3,
                type: 'host',
                minion: minionName[0],
                nodes: {},
                ...host,
              }

              const vms = host.vms
              vms.reduce((acc, vm, i) => {
                const vmName = vm.name
                acc[vcIpAddress]['nodes'][datacenterName]['nodes'][clusterName][
                  'nodes'
                ][hostName]['nodes'][vmName] = {
                  label: vmName,
                  index: i,
                  level: 4,
                  type: 'vm',
                  minion: minionName[0],
                  ...vm,
                }

                return acc
              }, acc)

              datacenterHosts.push(host)

              return acc
            }, acc)

            return acc
          }, acc)

          const hosts = datacenter.hosts
          hosts.reduce((acc, host, i) => {
            const hostName = host.name
            acc[vcIpAddress]['nodes'][datacenterName]['nodes'][hostName] = {
              label: hostName,
              index: i,
              level: 2,
              type: 'host',
              minion: minionName[0],
              nodes: {},
              ...host,
            }

            const vms = host.vms
            vms.reduce((acc, vm, i) => {
              const vmName = vm.name
              acc[vcIpAddress]['nodes'][datacenterName]['nodes'][hostName][
                'nodes'
              ][vmName] = {
                label: vmName,
                index: i,
                level: 3,
                type: 'vm',
                minion: minionName[0],
                ...vm,
              }

              return acc
            }, acc)

            datacenterHosts.push(host)

            return acc
          }, acc)

          return acc
        }, acc)

        return acc
      },
      {
        [vcIpAddress]: {
          label: vcIpAddress,
          index: 0,
          level: 0,
          type: 'vcenter',
          minion: minionName[0],
          nodes: {},
        },
      }
    )

    vcenter[vcIpAddress] = {
      ...vcenter[vcIpAddress],
      datacenters: vcDatacenters.length > 0 ? vcDatacenters : [],
      cpu_usage:
        vcCpuUsage.length > 0 ? vcCpuUsage.reduce((sum, c) => sum + c) : [],
      cpu_space:
        vcCpuSpace.length > 0 ? vcCpuSpace.reduce((sum, c) => sum + c) : [],
      memory_usage:
        vcMemoryUsage.length > 0
          ? vcMemoryUsage.reduce((sum, c) => sum + c)
          : [],
      memory_space:
        vcMemorySpace.length > 0
          ? vcMemorySpace.reduce((sum, c) => sum + c)
          : [],
      storage_usage:
        vcStorgeUsage.length > 0
          ? vcStorgeUsage.reduce((sum, c) => sum + c)
          : [],
      storage_space:
        vcStorgeSpace.length > 0
          ? vcStorgeSpace.reduce((sum, c) => sum + c)
          : [],
      storage_capacity:
        vcStorgeCapacity.length > 0
          ? vcStorgeCapacity.reduce((sum, c) => sum + c)
          : [],
      cluster_count:
        vcClustersCount.length > 0
          ? vcClustersCount.reduce((sum, c) => sum + c)
          : [],
      host_count:
        vcHostCount.length > 0 ? vcHostCount.reduce((sum, c) => sum + c) : [],
      vm_count:
        vcVmCount.length > 0 ? vcVmCount.reduce((sum, c) => sum + c) : [],
    }

    return vcenter
  }

  const CellTable = ({cell}): JSX.Element => {
    switch (cell.i) {
      case 'vcenter': {
        return (
          <VcenterTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={focusedHost}
          />
        )
      }
      case 'charts': {
        return (
          <>
            <h2 className={`dash-graph--name grid-layout--draggable`}>
              {cell.i}
            </h2>
          </>
        )
      }
      case 'datacenters': {
        return (
          <DatacentersTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={focusedHost.datacenters}
          />
        )
      }
      case 'datacenter': {
        return (
          <DatacenterTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={focusedHost}
          />
        )
      }
      case 'datastores': {
        return (
          <DatastoresTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={focusedHost.datastores}
          />
        )
      }
      case 'clusters': {
        return (
          <ClustersTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={focusedHost.clusters}
          />
        )
      }
      case 'cluster': {
        return (
          <ClusterTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={focusedHost}
          />
        )
      }
      case 'vmhosts': {
        return (
          <VMHostsTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={
              focusedHost.type === 'datacenter'
                ? focusedHost.datacenter_hosts
                : focusedHost.hosts
            }
          />
        )
      }
      case 'vmhost': {
        return (
          <VMHostTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={focusedHost}
          />
        )
      }
      case 'vms': {
        return (
          <VirtualMachinesTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={focusedHost.vms}
          />
        )
      }
      case 'vm': {
        return (
          <VirtualMachineTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={focusedHost}
          />
        )
      }
      default: {
        return null
      }
    }
  }

  const onSelectHost = (props): void => {
    setFocusedHost(props)
  }

  const threesizerDivisions = () => {
    const [leftSize, rightSize] = proportions
    return [
      {
        name: 'VMware Inventory',
        headerOrientation: HANDLE_VERTICAL,
        headerButtons: [
          <Button
            key={0}
            text={'+ Add vCenter'}
            onClick={handleOpen}
            size={ComponentSize.ExtraSmall}
          />,
        ],
        menuOptions: [],
        size: leftSize,
        render: () => (
          <FancyScrollbar>
            <TreeMenu
              data={vCenters}
              onClickItem={onSelectHost}
              // initialActiveKey={}
              // initialOpenNodes={}
            />
          </FancyScrollbar>
        ),
      },
      {
        headerOrientation: HANDLE_VERTICAL,
        headerButtons: [],
        menuOptions: [],
        size: rightSize,
        render: () => (
          <FancyScrollbar autoHide={false}>
            <GridLayout
              layout={layout}
              cols={12}
              rowHeight={calculateRowHeight()}
              margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
              containerPadding={[15, 15]}
              useCSSTransforms={true}
              onLayoutChange={handleLayoutChange}
              draggableHandle={'.grid-layout--draggable'}
              isDraggable={true}
              isResizable={true}
            >
              {layout
                ? _.map(
                    layout,
                    (cell): JSX.Element => (
                      <div
                        key={cell.i}
                        className="dash-graph grid-item--routers"
                        style={cellstyle}
                      >
                        <CellTable cell={cell} />
                      </div>
                    )
                  )
                : null}
            </GridLayout>
          </FancyScrollbar>
        ),
      },
    ]
  }

  const AddVCenter = minions => {
    let vcenter = minions.reduce((vc, minion) => {
      const vCenterInfo = getVCenterInfo(minion)
      vc = {...vc, ...vCenterInfo}
      return vc
    }, {})

    setVCenters({...vCenters, ...vcenter})
  }

  useEffect(() => {
    /////////////// getMinion Api Call ///////////////////
    const getMinions = ['minion03', 'minion06']
    /////////////// getMinion Api Call ///////////////////
    AddVCenter(getMinions)
  }, [])

  return (
    <div className="vm-status-page__container">
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">VMware</h2>
        </div>
        <div
          className="panel-body"
          style={{background: 'transparent', padding: '0'}}
        >
          <Threesizer
            orientation={HANDLE_VERTICAL}
            divisions={threesizerDivisions()}
            onResize={handleResize}
          />
          <HostModal
            isVisible={isModalVisible}
            headingTitle={'Connection vCenter'}
            onCancel={handleClose}
            onConfirm={handleConnection}
            message={
              <ConnectForm
                target={target}
                address={address}
                port={port}
                user={user}
                password={password}
                protocol={protocol}
                interval={interval}
                targetItems={acceptedMinionList}
                intervalItems={intervalItems}
                handleChangeTarget={handleChangeTarget}
                handleChangeAddress={handleChangeAddress}
                handleChangePort={handleChangePort}
                handleChangeUser={handleChangeUser}
                handleChangePassword={handleChangePassword}
                handleChangeProtocol={handleChangeProtocol}
                handleChangeInterval={handleChangeInterval}
              />
            }
            confirmText={'Add vCenter'}
            confirmButtonStatus={
              address &&
              port &&
              user &&
              password &&
              protocol &&
              target !== MINION_LIST_EMPTY
                ? ComponentStatus.Default
                : ComponentStatus.Disabled
            }
          />
        </div>
      </div>
    </div>
  )
}

const mapStateToProps = ({links: {addons}}) => {
  return {
    addons,
  }
}

const mapDispatchToProps = {
  handleGetMinionKeyAcceptedList: getMinionKeyAcceptedListAsync,
}

export default connect(mapStateToProps, mapDispatchToProps, null)(VMHostsPage)
