// Library
import React, {useState, useEffect, ChangeEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import classnames from 'classnames'

// Component
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {Button, ComponentSize} from 'src/reusable_ui'
import {cellLayoutInfo} from 'src/addon/128t/containers/SwanSdplexStatusPage'
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import ConfirmButton from 'src/shared/components/ConfirmButton'

import HostModal from 'src/hosts/components/HostModal'
import VMTreeMenu from 'src/hosts/components/VMTreeMenu'
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
import ChartsLayoutRenderer from 'src/hosts/components/ChartsLayoutRenderer'
import VMConnectForm from 'src/hosts/components/VMConnectForm'

// Type
import {TimeRange, Cell, Template, Source, Layout} from 'src/types'
import {Item} from 'src/reusable_ui/components/treemenu/TreeMenu/walk'
import {AddonType} from 'src/shared/constants'
import {Addon} from 'src/types/auth'
import {
  VMDatacenter,
  VMCluster,
  VMHost,
  VM,
  VMDatastore,
  LayoutCell,
  VCenter,
} from 'src/hosts/types'
import {ComponentStatus} from 'src/reusable_ui/types'

// Actions
import {
  getMinionKeyAcceptedListAsync,
  getVSphereInfoSaltApiAsync,
  getTicketRemoteConsoleAsync,
  addVCenterAsync,
  addVcenterAction,
  removeVcenter,
  updateVcenter,
  deleteVSphereAsync,
} from 'src/hosts/actions'

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

import {
  vcenterCells,
  datacenterCells,
  clusterCells,
  hostCells,
  vmCells,
} from 'src/hosts/constants/layout'

// Util
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {getCells} from 'src/hosts/utils/getCells'
import {getDeep} from 'src/utils/wrappers'

import {
  setLocalStorage,
  getLocalStorage,
  verifyLocalStorage,
} from 'src/shared/middleware/localStorage'

// APIs
import {
  getLayouts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'

const GridLayout = WidthProvider(ReactGridLayout)
const MINION_LIST_EMPTY = '<< Empty >>'
const VSPHERE_HOST = 'vsphere_host'
const VSPHERE_VM = 'vsphere_vm'

export interface vmParam {
  vmField: string
  vmVal: string
}

interface VMHostsPageLocalStorage {
  layout: {[name: string]: {[name: string]: LayoutCell[]}}
  focusedHost: Item
  activeKey: string
  openNodes: string[]
  proportions: number[]
}

interface Props {
  addons: Addon[]
  manualRefresh: number
  timeRange: TimeRange
  source: Source
  handleGetMinionKeyAcceptedList: (
    saltMasterUrl: string,
    saltMasterToken: string
  ) => Promise<string[]>
  handleGetVSphereInfoSaltApi: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minionId: string,
    address: string,
    user: string,
    password: string,
    port: string,
    protocol: string,
    interval: string
  ) => Promise<any>
  handleGetTicketRemoteConsoleAsync: (
    saltMasterUrl: string,
    saltMasterToken: string,
    minionId: string,
    address: string,
    user: string,
    password: string
  ) => Promise<String[]>
  handleAddVCenterAsync: (
    target: string,
    address: string,
    user: string,
    password: string,
    port: string,
    protocol: string,
    interval: string
  ) => any
  handleAddVcenterAction: (props: any) => Promise<any>
  handleRemoveVcenter: () => Promise<any>
  handleUpdateVcenter: () => Promise<any>
  handleDeleteVSphere: (id: number, host: string) => Promise<any>
  vspheres: any
  handleClearTimeout: (key: string) => void
}

const VMHostsPage = (props: Props): JSX.Element => {
  const {
    addons,
    manualRefresh,
    timeRange,
    source,
    handleGetMinionKeyAcceptedList,
    handleGetVSphereInfoSaltApi,
    handleGetTicketRemoteConsoleAsync,
    handleAddVCenterAsync,
    handleAddVcenterAction,
    handleRemoveVcenter,
    handleUpdateVcenter,
    handleDeleteVSphere,
    vspheres,
    handleClearTimeout,
  } = props
  const intervalItems = ['30s', '1m', '5m']
  const initialFocusedHost: Item = {
    hasNodes: false,
    isOpen: false,
    level: 0,
    key: '',
    label: '',
    name: '',
    type: '',
  }

  // treemenu state
  const [activeKey, setActiveKey] = useState('')
  const [openNodes, setOpenNodes] = useState([])

  // three sizer state
  const [proportions, setProportions] = useState([0.25, 0.75])
  const [isModalVisible, setIsModalVisible] = useState(false)

  // form state
  const [target, setTarget] = useState(MINION_LIST_EMPTY)
  const [address, setAddress] = useState('61.250.122.234')
  const [port, setPort] = useState('443')
  const [user, setUser] = useState('administrator@vsphere.local')
  const [password, setPassword] = useState('!234Qwer')
  const [protocol, setProtocol] = useState('https')
  const [interval, setInterval] = useState('1m')

  // host state
  const [focusedHost, setFocusedHost] = useState<Item>(initialFocusedHost)
  const [layout, setLayout] = useState<LayoutCell[]>([])
  const [vCenters, setVCenters] = useState({})
  const [acceptedMinionList, setAcceptedMinionList] = useState([])

  // graph state in charts
  const [layoutCells, setLayoutCells] = useState<Cell[]>([])
  const [tempVars, setTempVars] = useState<Template[]>([])
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [vmParam, setVmParam] = useState<vmParam>({vmField: '', vmVal: ''})
  const [vmParentChartField, setVmParentChartField] = useState('')
  const [vmParentName, setVmParentName] = useState('')
  const [selectMinion, setSelectMinion] = useState('')
  const [saltMasterUrl, setSaltMasterUrl] = useState('')
  const [saltMasterToken, setSaltMasterToken] = useState('')

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
    const addon: Addon = getSaltAddon()
    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    const minionList: string[] = await handleGetMinionKeyAcceptedList(
      saltMasterUrl,
      saltMasterToken
    )

    if (minionList && minionList.length > 0) {
      setTarget(minionList[0])
    }

    setAcceptedMinionList(minionList)
    setIsModalVisible(true)
  }

  const handleConnection = async () => {
    handleClose()

    const vSphereInfo = await handleGetVSphereInfoSaltApi(
      saltMasterUrl,
      saltMasterToken,
      target,
      address,
      user,
      password,
      port,
      protocol,
      interval
    )

    const resultAddVCenterAsync = await handleAddVCenterAsync(
      target,
      address,
      user,
      password,
      port,
      protocol,
      interval
    )

    if (vSphereInfo && resultAddVCenterAsync) {
      let dump = {}
      dump[address] = {
        ...resultAddVCenterAsync.data,
        nodes: {
          ...vSphereInfo,
        },
      }

      handleAddVcenterAction({...dump})
    }
  }

  const getSaltAddon = (): Addon => {
    const addon = addons.find(addon => {
      return addon.name === AddonType.salt
    })

    return addon
  }

  useEffect(() => {
    // create Treemenu Object
    const vsphereKeys = _.keys(vspheres)
    if (vsphereKeys.length > 0) {
      vsphereKeys.forEach(key => {
        if (vspheres[key]?.nodes) {
          console.log(vsphereKeys, key, vspheres, vspheres[key])
          let vcenter = makeTreeMenuVCenterInfo(vspheres[key])
          setVCenters({...vCenters, ...vcenter})
        }
      })
    } else {
      setVCenters({})
    }
  }, [vspheres])

  useEffect(() => {
    verifyLocalStorage(getLocalStorage, setLocalStorage, 'VMHostsPage', {
      proportions: [0.25, 0.75],
      focusedHost: initialFocusedHost,
      activeKey: '',
      openNodes: [],
      layout: {},
    })

    const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
    const {
      proportions: getProportions,
      focusedHost: getFocusedHost,
      activeKey: getActiveKey,
      openNodes: getOpenNodes,
    } = getLocal

    setActiveKey(getActiveKey)
    setOpenNodes(getOpenNodes)
    setProportions(getProportions)
    setFocusedHost(getFocusedHost)

    const layoutResultsFn = async (): Promise<void> => {
      const layoutRst = await getLayouts()
      const init_layouts = getDeep<Layout[]>(layoutRst, 'data.layouts', [])
      setLayouts(init_layouts)
    }
    layoutResultsFn()

    const addon: Addon = getSaltAddon()
    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    setSaltMasterUrl(saltMasterUrl)
    setSaltMasterToken(saltMasterToken)
  }, [])

  useEffect(() => {
    const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
    setLocalStorage('VMHostsPage', {
      ...getLocal,
      openNodes: _.uniq(openNodes),
      activeKey,
    })
  }, [openNodes, activeKey])

  const requestCharts = async (props: any) => {
    if (props.key === '' || props.type === '') return

    let measurement: string
    let vType: string = props.type
    if (vType === 'vm') {
      measurement = VSPHERE_VM
    } else {
      measurement = VSPHERE_HOST
    }

    const {filteredLayouts} = await getLayoutsforHostApp(
      layouts,
      props.minion,
      measurement
    )

    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)

    let vmParam: vmParam
    if (vType === 'vcenter') {
      vmParam = {
        vmField: 'vcenter',
        vmVal: props.label,
      }
    } else if (vType === 'datacenter') {
      vmParam = {
        vmField: 'dcname',
        vmVal: props.name,
      }
    } else if (vType === 'cluster') {
      vmParam = {
        vmField: 'clustername',
        vmVal: props.name,
      }
    } else if (vType === 'host') {
      vmParam = {
        vmField: 'esxhostname',
        vmVal: props.name,
      }
    } else if (vType === 'vm') {
      vmParam = {
        vmField: 'vmname',
        vmVal: props.name,
      }
    } else {
      return
    }

    if (props.parent_chart_field) {
      setVmParentChartField(props.parent_chart_field)
      setVmParentName(props.parent_name)
    }

    setLayoutCells(layoutCells)
    setTempVars(tempVars)
    setVmParam(vmParam)
  }

  useEffect(() => {
    const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
    const {layout: getLayout} = getLocal
    if (activeKey === '') return
    const getLayoutItem = getLayout[activeKey.split('/')[0]]

    if (focusedHost?.type) {
      const {type} = focusedHost
      if (type === 'vcenter') {
        if (
          getLayoutItem &&
          getLayoutItem?.vcenter &&
          getLayoutItem.vcenter.length > 0
        ) {
          setLayout(getLayoutItem.vcenter)
        } else {
          setLayout(vcenterCells)
        }
      } else if (type === 'datacenter') {
        if (
          getLayoutItem &&
          getLayoutItem?.datacenter &&
          getLayoutItem.datacenter.length > 0
        ) {
          setLayout(getLayoutItem.datacenter)
        } else {
          setLayout(datacenterCells)
        }
      } else if (type === 'cluster') {
        if (
          getLayoutItem &&
          getLayoutItem?.cluster &&
          getLayoutItem.cluster.length > 0
        ) {
          setLayout(getLayoutItem.cluster)
        } else {
          setLayout(clusterCells)
        }
      } else if (type === 'host') {
        if (
          getLayoutItem &&
          getLayoutItem?.host &&
          getLayoutItem.host.length > 0
        ) {
          setLayout(getLayoutItem.host)
        } else {
          setLayout(hostCells)
        }
      } else if (type === 'vm') {
        if (getLayoutItem && getLayoutItem?.vm && getLayoutItem.vm.length > 0) {
          setLayout(getLayoutItem.vm)
        } else {
          setLayout(vmCells)
        }
      }
    }

    requestCharts(focusedHost)
    setLocalStorage('VMHostsPage', {...getLocal, focusedHost})
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

  const debouncedFit = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 250)

  const debouncedProportionsHOC = (proportions: number[]) => {
    const debouncedProportions = _.debounce(() => {
      const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
      setLocalStorage('VMHostsPage', {...getLocal, proportions})
    }, 250)

    return debouncedProportions()
  }

  const handleResize = (proportions: number[]) => {
    debouncedProportionsHOC(proportions)
    setProportions(proportions)
    debouncedFit()
  }

  // set localstorage
  const handleLayoutChange = (cellsLayout: cellLayoutInfo[]): void => {
    const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
    let {layout} = getLocal

    if (focusedHost.type === 'vcenter') {
      layout[activeKey.split('/')[0]] = {
        ...layout[activeKey.split('/')[0]],
        vcenter: cellsLayout,
      }
    } else if (focusedHost.type === 'datacenter') {
      layout[activeKey.split('/')[0]] = {
        ...layout[activeKey.split('/')[0]],
        datacenter: cellsLayout,
      }
    } else if (focusedHost.type === 'cluster') {
      layout[activeKey.split('/')[0]] = {
        ...layout[activeKey.split('/')[0]],
        cluster: cellsLayout,
      }
    } else if (focusedHost.type === 'host') {
      layout[activeKey.split('/')[0]] = {
        ...layout[activeKey.split('/')[0]],
        host: cellsLayout,
      }
    } else if (focusedHost.type === 'vm') {
      layout[activeKey.split('/')[0]] = {
        ...layout[activeKey.split('/')[0]],
        vm: cellsLayout,
      }
    }

    setLocalStorage('VMHostsPage', {...getLocal, layout})
  }

  const updateBtn = (ipAddress: string) => (): JSX.Element => {
    return (
      <button className={`btn btn-default btn-xs btn-square`}>
        <span
          className={`icon pencil`}
          onClick={e => {
            e.stopPropagation()
            console.log('updateBtn: ', ipAddress)
          }}
        />
      </button>
    )
  }

  const removeBtn = (id: number, host: 'string') => (): JSX.Element => {
    return (
      <ConfirmButton
        text="Delete"
        type="btn-danger"
        size="btn-xs"
        icon={'trash'}
        confirmAction={() => {
          handleDeleteVSphere(id, host)
          handleClearTimeout(host)
        }}
        isEventStopPropagation={true}
        isButtonLeaveHide={true}
        isHideText={true}
        square={true}
      />
    )
  }

  const makeTreeMenuVCenterInfo = props => {
    const vCenterData = props.nodes

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
    let minionName = Object.keys(vCenterData.return[0])
    let vcMinionValue: any[] = Object.values(vCenterData.return[0])
    let vcIpAddress = props.host
    // let vcIpAddress = address

    let vcenter = [vCenterData].reduce(
      acc => {
        const datacenters: VMDatacenter[] = vcMinionValue[0].datacenters
        if (!datacenters) return

        datacenters.reduce((acc, datacenter, i) => {
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
            parent_name: vcIpAddress,
            parent_chart_field: 'vcenter',
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
              parent_name: `${vcIpAddress}/${datacenterName}`,
              parent_chart_field: 'vcenter/dcname',
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
                parent_type: 'cluster',
                parent_name: `${vcIpAddress}/${datacenterName}/${clusterName}`,
                parent_chart_field: 'vcenter/dcname/clustername',
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
                  parent_name: `${vcIpAddress}/${datacenterName}/${clusterName}/${hostName}`,
                  parent_chart_field: 'vcenter/dcname/clustername/esxhostname',
                  minion: minionName[0],
                  ...vm,
                }

                return acc
              }, acc)

              datacenterHosts.push(
                acc[vcIpAddress]['nodes'][datacenterName]['nodes'][clusterName][
                  'nodes'
                ][hostName]
              )

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
              parent_type: 'datacenter',
              parent_name: `${vcIpAddress}/${datacenterName}`,
              parent_chart_field: 'vcenter/dcname',
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
                parent_name: `${vcIpAddress}/${datacenterName}/${hostName}`,
                parent_chart_field: 'vcenter/dcname/esxhostname',
                minion: minionName[0],
                ...vm,
              }

              return acc
            }, acc)

            datacenterHosts.push(
              acc[vcIpAddress]['nodes'][datacenterName]['nodes'][hostName]
            )

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

    if (!vcenter) return
    vcenter[vcIpAddress] = {
      ...vcenter[vcIpAddress],

      buttons: [updateBtn(vcIpAddress), removeBtn(props.id, props.host)],
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

  const fetchHostsAndMeasurements = async (
    layouts: Layout[],
    hostID: string
  ) => {
    const fetchMeasurements = getMeasurementsForHost(source, hostID)
    const fetchHosts = getAppsForHost(
      source.links.proxy,
      hostID,
      layouts,
      source.telegraf
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])

    return {host, measurements}
  }

  const getLayoutsforHostApp = async (
    layouts: Layout[],
    hostID: string,
    _measurement: string
  ) => {
    const {host, measurements} = await fetchHostsAndMeasurements(
      layouts,
      hostID
    )

    const layoutsWithinHost = layouts.filter(layout => {
      return (
        host.apps &&
        host.apps.includes(layout.app) &&
        measurements.includes(layout.measurement)
      )
    })

    const filteredLayouts = layoutsWithinHost
      .filter(layout => {
        return layout.measurement.indexOf(_measurement) !== -1
      })
      .sort((x, y) => {
        return x.measurement < y.measurement
          ? -1
          : x.measurement > y.measurement
          ? 1
          : 0
      })

    return {filteredLayouts}
  }

  const CellTable = ({cell}: {cell: LayoutCell}): JSX.Element => {
    console.log('CellTable: ', cell)
    switch (cell.i) {
      case 'vcenter': {
        let item: VCenter = vCenters[activeKey] || null

        return (
          <VcenterTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={item}
          />
        )
      }
      case 'charts': {
        return (
          <ChartsLayoutRenderer
            source={source}
            layoutCells={layoutCells}
            tempVars={tempVars}
            timeRange={timeRange}
            manualRefresh={manualRefresh}
            vmParam={vmParam}
            vmParentChartField={vmParentChartField}
            vmParentName={vmParentName}
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
          />
        )
      }
      case 'datacenters': {
        let items: VMDatacenter[] = []
        if (focusedHost.type === 'vcenter') {
          items = _.filter(
            vCenters[activeKey.split('/')[0]].nodes,
            k => k.type === 'datacenter'
          )
        }
        return (
          <DatacentersTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            handleSelectHost={handleSelectHost}
            items={items}
          />
        )
      }
      case 'datacenter': {
        let item: VMDatacenter = null

        if (focusedHost.type === 'datacenter') {
          item =
            vCenters[activeKey.split('/')[0]].nodes[activeKey.split('/')[1]]
        }

        return (
          <DatacenterTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={item}
          />
        )
      }
      case 'datastores': {
        let items: VMDatastore[] = []

        if (focusedHost.type === 'datacenter') {
          items =
            vCenters[activeKey.split('/')[0]].nodes[focusedHost.name].datastores
        } else if (focusedHost.type === 'cluster') {
          items =
            vCenters[activeKey.split('/')[0]].nodes[activeKey.split('/')[1]]
              .nodes[focusedHost.name].datastores
        }
        return (
          <DatastoresTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            items={items}
          />
        )
      }
      case 'clusters': {
        let items: VMCluster[] = []
        if (focusedHost.type === 'datacenter') {
          const splitedActiveKey = activeKey.split('/')
          items = _.filter(
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes,
            (k: VMCluster | VMHost) => k.type === 'cluster'
          )
        }

        return (
          <ClustersTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            handleSelectHost={handleSelectHost}
            items={items}
          />
        )
      }
      case 'cluster': {
        let item: VMCluster = null

        if (focusedHost.type === 'cluster') {
          const splitedActiveKey = activeKey.split('/')
          item =
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
              splitedActiveKey[2]
            ]
        }

        return (
          <ClusterTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={item}
          />
        )
      }
      case 'vmhosts': {
        let items: VMHost[] = []
        const splitedActiveKey = activeKey.split('/')
        if (focusedHost.type === 'cluster') {
          items = _.filter(
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
              focusedHost.name
            ].nodes,
            (k: VMHost) => k.type === 'host'
          )
        } else if (focusedHost.type === 'datacenter') {
          items =
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]]
              .datacenter_hosts
        }

        return (
          <VMHostsTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            handleSelectHost={handleSelectHost}
            items={items}
          />
        )
      }
      case 'vmhost': {
        let item: VMHost = null

        const splitedActiveKey = activeKey.split('/')
        if (focusedHost.parent_type === 'cluster') {
          item =
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
              splitedActiveKey[2]
            ].nodes[splitedActiveKey[3]]
        } else if (focusedHost.parent_type === 'datacenter') {
          item =
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
              splitedActiveKey[2]
            ]
        }

        return (
          <VMHostTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={item}
          />
        )
      }
      case 'vms': {
        let items: VM[] = []
        const splitedActiveKey = activeKey.split('/')
        if (
          focusedHost.parent_type === 'cluster' &&
          focusedHost.type === 'host'
        ) {
          items = _.filter(
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
              splitedActiveKey[2]
            ].nodes[splitedActiveKey[3]].nodes,
            k => k.type === 'vm'
          )
        } else if (
          focusedHost.parent_type === 'datacenter' &&
          focusedHost.type === 'host'
        ) {
          items = _.filter(
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
              splitedActiveKey[2]
            ].nodes,
            (k: VM) => k.type === 'vm'
          )
        }
        return (
          <VirtualMachinesTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            handleSelectHost={handleSelectHost}
            items={items}
          />
        )
      }
      case 'vm': {
        let item: VM = null
        const splitedActiveKey = activeKey.split('/')

        if (splitedActiveKey.length === 5) {
          item =
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
              splitedActiveKey[2]
            ].nodes[splitedActiveKey[3]].nodes[splitedActiveKey[4]]
        } else if (splitedActiveKey.length === 4) {
          item =
            vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
              splitedActiveKey[2]
            ].nodes[splitedActiveKey[3]]
        }

        return (
          <VirtualMachineTable
            isEditable={true}
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            item={item}
            selectMinion={selectMinion}
            handleGetTicketRemoteConsoleAsync={
              handleGetTicketRemoteConsoleAsync
            }
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
          />
        )
      }
      default: {
        return null
      }
    }
  }

  const handleSelectHost = async (props: any) => {
    const p = Array.isArray(props) ? props : [props]
    const path: string[] = p[0].parent_name.split('/')
    const newPath: string[] = []

    if (path.length <= 1) {
      newPath.push(path[0])
    } else {
      path.reduce((acc: string, current: string, index: number) => {
        if (index === 1) {
          newPath.push(acc)
        }

        const value = `${acc}/${current}`
        newPath.push(value)
        return value
      })
    }

    setSelectMinion(p[0].minion)
    setActiveKey(p[0].parent_name + '/' + p[0].name)
    setOpenNodes([...openNodes, ...newPath])
    setFocusedHost(p[0])
  }

  const onClickToggle = (node: string): void => {
    const newOpenNodes = openNodes.includes(node)
      ? openNodes.filter(openNode => openNode !== node)
      : [...openNodes, node]

    setOpenNodes(newOpenNodes)
  }

  const onSelectHost = (props: Item) => {
    setActiveKey(props.key)
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
            <VMTreeMenu
              data={vCenters}
              onClickItem={onSelectHost}
              onClickToggle={onClickToggle}
              activeKey={activeKey}
              openNodes={openNodes}
            />
          </FancyScrollbar>
        ),
      },
      {
        headerOrientation: HANDLE_VERTICAL,
        headerButtons: [],
        menuOptions: [],
        size: rightSize,
        render: () => {
          const isVCenters = _.keys(vCenters).length
          return isVCenters ? (
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
                      (cell: LayoutCell): JSX.Element => (
                        <div
                          key={cell.i}
                          className={classnames(
                            'dash-graph grid-item--routers',
                            {'grid-item--charts': cell.i === 'charts'}
                          )}
                          style={cellstyle}
                        >
                          <CellTable cell={cell} />
                        </div>
                      )
                    )
                  : null}
              </GridLayout>
            </FancyScrollbar>
          ) : null
        },
      },
    ]
  }

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
              <VMConnectForm
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

const mapStateToProps = ({links: {addons}, vspheres}) => {
  return {
    addons,
    vspheres,
  }
}

const mapDispatchToProps = {
  handleGetMinionKeyAcceptedList: getMinionKeyAcceptedListAsync,
  handleGetVSphereInfoSaltApi: getVSphereInfoSaltApiAsync,
  handleGetTicketRemoteConsoleAsync: getTicketRemoteConsoleAsync,
  handleAddVCenterAsync: addVCenterAsync,
  handleAddVcenterAction: addVcenterAction,
  handleRemoveVcenter: removeVcenter,
  handleUpdateVcenter: updateVcenter,
  handleDeleteVSphere: deleteVSphereAsync,
}

export default connect(mapStateToProps, mapDispatchToProps, null)(VMHostsPage)
