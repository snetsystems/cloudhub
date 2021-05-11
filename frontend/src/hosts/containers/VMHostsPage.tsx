// Library
import React, {useState, useEffect, useCallback, ChangeEvent} from 'react'
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
import PageSpinner from 'src/shared/components/PageSpinner'

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
import {TimeRange, Source, Layout, Me} from 'src/types'
import {
  Item,
  TreeNode,
  TreeNodeInArray,
} from 'src/reusable_ui/components/treemenu/TreeMenu/walk'

import {AddonType} from 'src/shared/constants'
import {Addon} from 'src/types/auth'
import {
  VMDatacenter,
  VMCluster,
  VMHost,
  VM,
  LayoutCell,
  VCenter,
  VcenterStatus,
  reducerVSphere,
  VMRole,
  VMHostsPageLocalStorage,
  ResponseVSphere,
  ResponseDatacenter,
} from 'src/hosts/types'
import {ComponentStatus} from 'src/reusable_ui/types'

// Actions
import {
  getMinionKeyAcceptedListAsync,
  getVSphereInfoSaltApiAsync,
  getTicketRemoteConsoleAsync,
  addVCenterAsync,
  addVcenterAction,
  updateVSphereAsync,
  updateVcenterAction,
  deleteVSphereAsync,
  getVSphereAsync,
  RequestVcenterAction,
  ResponseVcenterAction,
  RequestPauseVcenterAction,
  RequestRunVcenterAction,
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

// Constants
import {isUserAuthorized, EDITOR_ROLE} from 'src/auth/Authorized'

const GridLayout = WidthProvider(ReactGridLayout)
const MINION_LIST_EMPTY = '<< Empty >>'
const VSPHERE_HOST = 'vsphere_host'
const VSPHERE_VM = 'vsphere_vm'

export interface vmParam {
  vmField: string
  vmVal: string
}

interface Auth {
  me: Me
  isUsingAuth: boolean
}

interface Props {
  auth: Auth
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
    protocol: string
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
    interval: string,
    sourceID: string
  ) => any
  handleUpdateVSphereAsync: (
    id: string,
    target: string,
    address: string,
    user: string,
    password: string,
    port: string,
    protocol: string,
    interval: string,
    sourceID: string
  ) => Promise<any>
  handleGetVSphereAsync: (id: string) => Promise<any>
  handleAddVcenterAction: (props: any) => Promise<any>
  handleRemoveVcenter: () => Promise<any>
  handleUpdateVcenter: () => Promise<any>
  handleDeleteVSphere: (id: string, host: string) => Promise<any>
  vspheres: reducerVSphere
  handleClearTimeout: (key: string) => void
  handleUpdateVcenterAction: ({
    host,
    id,
    interval,
    links,
    minion,
    nodes,
    organization,
    password,
    port,
    protocol,
    username,
  }: reducerVSphere['vspheres']['host']) => void
  handleRequestAction: () => void
  handleResponseAction: () => void
  handleRequestPauseVcenterAction: (host: string, id: string) => void
  handleRequestRunVcenterAction: (host: string, id: string) => void
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
    handleUpdateVSphereAsync,
    handleAddVcenterAction,
    handleDeleteVSphere,
    vspheres,
    handleClearTimeout,
    handleGetVSphereAsync,
    handleUpdateVcenterAction,
    handleRequestAction,
    handleResponseAction,
    handleRequestPauseVcenterAction,
    handleRequestRunVcenterAction,
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
  const [openNodes, setOpenNodes] = useState([])

  // three sizer state
  const [proportions, setProportions] = useState([0.25, 0.75])
  const [isModalVisible, setIsModalVisible] = useState(false)

  // form state
  const [target, setTarget] = useState(MINION_LIST_EMPTY)
  const [address, setAddress] = useState('')
  const [port, setPort] = useState('443')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [protocol, setProtocol] = useState('https')
  const [interval, setInterval] = useState('1m')
  const [vSphereId, setVSphereId] = useState('0')

  // host state
  const [focusedHost, setFocusedHost] = useState<Item>(initialFocusedHost)
  const [layout, setLayout] = useState<LayoutCell[]>([])
  const [vCenters, setVCenters] = useState<
    {[name: string]: TreeNode} | TreeNodeInArray[]
  >({})

  const [acceptedMinionList, setAcceptedMinionList] = useState([])

  // graph state in charts
  const [layouts, setLayouts] = useState<Layout[]>([])
  const [selectMinion, setSelectMinion] = useState('')
  const [saltMasterUrl, setSaltMasterUrl] = useState('')
  const [saltMasterToken, setSaltMasterToken] = useState('')
  const [isUpdate, setIsUpdate] = useState(false)

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
    setAddress('')
    setUser('')
    setPassword('')
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
    setIsUpdate(false)
  }

  const handleUpdateOpen = async (id: string): Promise<void> => {
    const vsphereInfo = await handleGetVSphereAsync(id)
    const addon: Addon = getSaltAddon()
    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    const minionList: string[] = await handleGetMinionKeyAcceptedList(
      saltMasterUrl,
      saltMasterToken
    )

    if (minionList && minionList.length > 0) {
      setTarget(_.get(vsphereInfo, 'minion', MINION_LIST_EMPTY))
      setAcceptedMinionList(minionList)
    } else {
      setTarget(MINION_LIST_EMPTY)
    }

    setAddress(_.get(vsphereInfo, 'host', ''))
    setPort(_.get(vsphereInfo, 'port', '443'))
    setUser(_.get(vsphereInfo, 'username', ''))
    setPassword(_.get(vsphereInfo, 'password', ''))
    setProtocol(_.get(vsphereInfo, 'protocol', 'https'))
    setInterval(calcInterval(_.get(vsphereInfo, 'interval', '60000')))
    setIsModalVisible(true)
    setIsUpdate(true)
    setVSphereId(id)
  }

  const handleConnection = async () => {
    if (isUpdate) {
      vSphereUpdateInfo()
    } else {
      vSphereNewConnection()
    }
  }

  const calcInterval = (interval: string) => {
    const interv = parseInt(interval) / 1000
    let result = '1m'
    if (interv === 30) {
      result = '30s'
    } else {
      result = interv / 60 + 'm'
    }
    return result
  }

  const vSphereUpdateInfo = async () => {
    const vsphereInfo = await handleGetVSphereAsync(vSphereId)
    handleRequestAction()
    handleGetVSphereInfoSaltApi(
      saltMasterUrl,
      saltMasterToken,
      target,
      address,
      user,
      password,
      port,
      protocol
    )
      .then((result: ResponseVSphere) => {
        if (!result) return
        handleUpdateVSphereAsync(
          vSphereId,
          target,
          address !== _.get(vsphereInfo, 'host', '') ? address : null,
          user !== _.get(vsphereInfo, 'username', '') ? user : null,
          password !== _.get(vsphereInfo, 'password', '') ? password : null,
          port !== _.get(vsphereInfo, 'port', '') ? port : null,
          protocol !== _.get(vsphereInfo, 'protocol', '') ? protocol : null,
          interval !== calcInterval(_.get(vsphereInfo, 'interval', 0))
            ? interval
            : null,
          source.id
        ).then(async ({data}) => {
          const oldHost = _.get(vsphereInfo, 'host', '')
          const getLocal: VMHostsPageLocalStorage = getLocalStorage(
            'VMHostsPage'
          )

          const {layout: getLayout} = getLocal
          delete getLayout[oldHost]

          setLocalStorage('VMHostsPage', {...getLocal, layout: getLayout})
          removeOpenNodes(oldHost)
          handleUpdateVcenterAction({...data, isPause: false, nodes: result})
          handleClose()
        })
      })
      .catch(err => {
        console.error('err: ', err)
      })
      .finally(() => {
        handleResponseAction()
      })
  }

  const vSphereNewConnection = async () => {
    handleRequestAction()
    handleGetVSphereInfoSaltApi(
      saltMasterUrl,
      saltMasterToken,
      target,
      address,
      user,
      password,
      port,
      protocol
    )
      .then(async vSphereInfo => {
        if (!vSphereInfo) return

        const resultAddVCenterAsync = await handleAddVCenterAsync(
          target,
          address,
          user,
          password,
          port,
          protocol,
          interval,
          source.id
        )

        if (vSphereInfo && resultAddVCenterAsync) {
          const dump = {
            [address]: {
              ...resultAddVCenterAsync.data,
              nodes: {
                ...vSphereInfo,
                isPause: false,
              },
            },
          }

          handleAddVcenterAction({...dump})
          handleClose()
        }
      })
      .finally(() => {
        handleResponseAction()
      })
  }
  const getSaltAddon = (): Addon => {
    const addon = addons.find(addon => {
      return addon.name === AddonType.salt
    })

    return addon
  }

  const modifiedCellID = (cells: LayoutCell[]) => {
    const modifiedID = _.map(cells, cell => {
      const c = {
        ...cell,
        i: focusedHost.key.split('/')[0] + '-' + cell.i,
      }
      return c
    })
    return modifiedID
  }

  useEffect(() => {
    // create Treemenu Object
    const {vspheres: getVSpheres} = vspheres
    const vsphereKeys = _.keys(getVSpheres)
    const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
    let getLayout: {
        [name: string]: {
          [name: string]: LayoutCell[]
        }
      },
      getFocusedHost: Item

    if (getLocal) {
      const {layout, focusedHost} = getLocal
      getLayout = layout
      getFocusedHost = focusedHost
    }

    if (vsphereKeys.length > 0) {
      let makeTreemenus
      _.forEach(vsphereKeys, key => {
        const vsphere = getVSpheres[key]

        makeTreemenus = {
          ...makeTreemenus,
          ...makeTreeMenuVCenterInfo(vsphere),
        }
      })

      const vCentersKeys = _.keys(vCenters)
      const makeTreemenusKey = _.keys(makeTreemenus)

      const addChartsInfoFocusedHostFn = async (): Promise<void> => {
        const addChartsInfoFocusedHost = await requestCharts(
          makeTreemenus[makeTreemenusKey[0]]
        )
        setFocusedHost(addChartsInfoFocusedHost)
        const vcenter = getLayout?.[addChartsInfoFocusedHost?.key]?.vcenter
        if (vcenter) {
          setLayout(vcenter)
        } else if (focusedHost?.key && addChartsInfoFocusedHost?.key) {
          setLayout(modifiedCellID(vcenterCells))
        }
      }

      // deleting "vsphere"
      if (vCentersKeys.length > makeTreemenusKey.length) {
        // Local focus and localstorage focus were the same
        if (
          focusedHost?.key.split('/')[0] === getFocusedHost.key.split('/')[0]
        ) {
          if (!_.includes(makeTreemenusKey, focusedHost.key.split('/')[0])) {
            // Local focus and localstorage focus were the same,
            // but after deleting "vsphere" they are not the same.
            addChartsInfoFocusedHostFn()
          }
        } else {
          // Local focus and localstorage focus were not the same.
          addChartsInfoFocusedHostFn()
        }
      } else if (!getFocusedHost?.key) {
        // There is no "key" for "focusedHost" in localstorage.
        addChartsInfoFocusedHostFn()
      } else {
        // Normal situation.
        if (focusedHost?.key) {
          // Normal situation when there is a "key" for "focusedHost" in the "state"
          if (
            focusedHost?.key.split('/')[0] === getFocusedHost.key.split('/')[0]
          ) {
            if (!_.includes(makeTreemenusKey, focusedHost.key.split('/')[0])) {
              // Normal situation when there is a "key" for "focused Host" in the "state".
              // and Local focus and localstorage focus were the same.
              // However, that "key" is not included in the tree menu.
              addChartsInfoFocusedHostFn()
            }
          } else {
            // Normal situation when there is a "key" for "focusedHost" in the "state".
            // but Local focus and localstorage focus were not the same.
            addChartsInfoFocusedHostFn()
          }
        }
      }

      if (makeTreemenus) {
        let sortTreemenus = {}
        _.forEach(_.keys(makeTreemenus).sort(), key => {
          sortTreemenus[key] = {
            ...makeTreemenus[key],
          }
        })

        setVCenters(sortTreemenus)
      }
    } else {
      setVCenters({})
    }
  }, [vspheres])

  useEffect(() => {
    const {vspheres} = props.vspheres
    const vsphereKeys = _.keys(vspheres)

    if (vsphereKeys.length > 0) {
      let makeTreemenus
      _.forEach(_.keys(vspheres), key => {
        const vsphere = vspheres[key]

        makeTreemenus = {
          ...makeTreemenus,
          ...makeTreeMenuVCenterInfo(vsphere),
        }
      })

      if (makeTreemenus) {
        let sortTreemenus = {}
        _.forEach(_.keys(makeTreemenus).sort(), key => {
          sortTreemenus[key] = {
            ...makeTreemenus[key],
          }
        })

        setVCenters(sortTreemenus)
      }
    }

    verifyLocalStorage(getLocalStorage, setLocalStorage, 'VMHostsPage', {
      proportions: [0.25, 0.75],
      focusedHost: initialFocusedHost,
      openNodes: [],
      layout: {},
    })

    const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
    const {
      proportions: getProportions,
      focusedHost: getFocusedHost,
      openNodes: getOpenNodes,
    } = getLocal
    let mountOpenNodes = []

    _.reduce(getFocusedHost.key.split('/'), (acc, current, index) => {
      if (index === 1) {
        mountOpenNodes = [...mountOpenNodes, acc]
      }
      const addSlash = `${acc}/${current}`
      mountOpenNodes = [...mountOpenNodes, addSlash]
      return addSlash
    })

    setSelectMinion(getFocusedHost.minion)
    setOpenNodes([...getOpenNodes, ...mountOpenNodes])
    setProportions(getProportions)
    const addChartsInfoFocusedHostFn = async (): Promise<void> => {
      const addChartsInfoFocusedHost = await requestCharts(getFocusedHost)
      setFocusedHost(addChartsInfoFocusedHost)
    }
    addChartsInfoFocusedHostFn()

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
    })
  }, [openNodes])

  const requestCharts = async (props: Item) => {
    if (props.key === '' || props.type === '') return

    let measurement: string
    let vType: string = props.type
    if (vType === VMRole.vm) {
      measurement = VSPHERE_VM
    } else {
      measurement = VSPHERE_HOST
    }

    let init_layouts: Layout[] = []
    if (layouts.length === 0) {
      const layoutRst = await getLayouts()
      init_layouts = getDeep<Layout[]>(layoutRst, 'data.layouts', [])
    }

    const {filteredLayouts} = await getLayoutsforHostApp(
      layouts.length > 0 ? layouts : init_layouts,
      props.minion,
      measurement
    )

    const getLayoutCells = getCells(filteredLayouts, source)
    const getTempVars = generateForHosts(source)

    let vmParam: vmParam
    if (vType === VMRole.vcenter) {
      vmParam = {
        vmField: 'vcenter',
        vmVal: props.label,
      }
    } else if (vType === VMRole.datacenter) {
      vmParam = {
        vmField: 'dcname',
        vmVal: props.name,
      }
    } else if (vType === VMRole.cluster) {
      vmParam = {
        vmField: 'clustername',
        vmVal: props.name,
      }
    } else if (vType === VMRole.host) {
      vmParam = {
        vmField: 'esxhostname',
        vmVal: props.name,
      }
    } else if (vType === VMRole.vm) {
      vmParam = {
        vmField: 'vmname',
        vmVal: props.name,
      }
    } else {
      return
    }

    props['vmParam'] = vmParam
    props['layoutCells'] = getLayoutCells
    props['tempVars'] = getTempVars

    return props
  }

  useEffect(() => {
    const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
    const {layout: getLayout} = getLocal
    if (!_.get(focusedHost, 'key')) return
    const getLayoutItem = getLayout[focusedHost.key.split('/')[0]]

    if (focusedHost?.type) {
      const {type} = focusedHost
      if (type === VMRole.vcenter) {
        if (
          getLayoutItem &&
          getLayoutItem?.vcenter &&
          getLayoutItem.vcenter.length > 0
        ) {
          setLayout(getLayoutItem.vcenter)
        } else {
          setLayout(modifiedCellID(vcenterCells))
        }
      } else if (type === VMRole.datacenter) {
        if (
          getLayoutItem &&
          getLayoutItem?.datacenter &&
          getLayoutItem.datacenter.length > 0
        ) {
          setLayout(getLayoutItem.datacenter)
        } else {
          setLayout(modifiedCellID(datacenterCells))
        }
      } else if (type === VMRole.cluster) {
        if (
          getLayoutItem &&
          getLayoutItem?.cluster &&
          getLayoutItem.cluster.length > 0
        ) {
          setLayout(getLayoutItem.cluster)
        } else {
          setLayout(modifiedCellID(clusterCells))
        }
      } else if (type === VMRole.host) {
        if (
          getLayoutItem &&
          getLayoutItem?.host &&
          getLayoutItem.host.length > 0
        ) {
          setLayout(getLayoutItem.host)
        } else {
          setLayout(modifiedCellID(hostCells))
        }
      } else if (type === VMRole.vm) {
        if (getLayoutItem && getLayoutItem?.vm && getLayoutItem.vm.length > 0) {
          setLayout(getLayoutItem.vm)
        } else {
          setLayout(modifiedCellID(vmCells))
        }
      }
    }

    const filteredFocusedHost = {
      key: focusedHost?.key,
      label: focusedHost?.label,
      layoutCells: focusedHost?.layoutCells,
      minion: focusedHost?.minion,
      openNodes: focusedHost?.openNodes,
      tempVars: focusedHost?.tempVars,
      type: focusedHost?.type,
      vmParam: focusedHost?.vmParam,
      index: focusedHost?.index,
      isOpen: focusedHost?.isOpen,
      level: focusedHost?.level,
      parent: focusedHost?.parent,
      parent_chart_field: focusedHost?.parent_chart_field,
      parent_name: focusedHost?.parent_name,
      parent_type: focusedHost?.parent_type,
    }

    setLocalStorage('VMHostsPage', {
      ...getLocal,
      focusedHost: filteredFocusedHost,
    })
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

  const handleLayoutChange = (cellsLayout: cellLayoutInfo[]): void => {
    const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
    let {layout} = getLocal
    const getActiveKey: string = _.get(focusedHost, 'key', '')
    if (focusedHost.type === VMRole.vcenter) {
      layout[getActiveKey.split('/')[0]] = {
        ...layout[getActiveKey.split('/')[0]],
        vcenter: cellsLayout,
      }
    } else if (focusedHost.type === VMRole.datacenter) {
      layout[getActiveKey.split('/')[0]] = {
        ...layout[getActiveKey.split('/')[0]],
        datacenter: cellsLayout,
      }
    } else if (focusedHost.type === VMRole.cluster) {
      layout[getActiveKey.split('/')[0]] = {
        ...layout[getActiveKey.split('/')[0]],
        cluster: cellsLayout,
      }
    } else if (focusedHost.type === VMRole.host) {
      layout[getActiveKey.split('/')[0]] = {
        ...layout[getActiveKey.split('/')[0]],
        host: cellsLayout,
      }
    } else if (focusedHost.type === VMRole.vm) {
      layout[getActiveKey.split('/')[0]] = {
        ...layout[getActiveKey.split('/')[0]],
        vm: cellsLayout,
      }
    }

    setLocalStorage('VMHostsPage', {...getLocal, layout})
  }

  const updateBtn = (id: string) => (): JSX.Element => {
    const {
      auth: {me, isUsingAuth},
    } = props

    return !isUsingAuth || isUserAuthorized(me.role, EDITOR_ROLE) ? (
      <button className={`btn btn-default btn-xs btn-square`}>
        <span
          className={`icon pencil`}
          onClick={() => {
            handleUpdateOpen(id)
          }}
        />
      </button>
    ) : null
  }

  const intervalCallOnOffBtn = (
    isPause: boolean,
    id: string,
    host: string
  ) => (): JSX.Element => {
    return (
      <button
        className={`btn btn-default btn-xs btn-square`}
        onClick={e => {
          e.stopPropagation()
          isPause
            ? handleRequestRunVcenterAction(host, id)
            : handleRequestPauseVcenterAction(host, id)
        }}
      >
        {isPause ? '▶' : '■'}
      </button>
    )
  }

  const removeBtn = (id: string, host: string) => (): JSX.Element => {
    const {
      auth: {me, isUsingAuth},
    } = props

    return !isUsingAuth || isUserAuthorized(me.role, EDITOR_ROLE) ? (
      <ConfirmButton
        text="Delete"
        type="btn-danger"
        size="btn-xs"
        icon={'trash'}
        confirmAction={() => {
          handleDeleteVSphere(id, host).then(data => {
            if (data === 'DELETE_SUCCESS') {
              handleClearTimeout(host)
              removeOpenNodes(host)
              const getLocal: VMHostsPageLocalStorage = getLocalStorage(
                'VMHostsPage'
              )

              const {layout: getLayout, focusedHost: getFocusedHost} = getLocal
              delete getLayout[host]

              if (getFocusedHost.key.split('/')[0] === host) {
                setFocusedHost(initialFocusedHost)
                setLocalStorage('VMHostsPage', {
                  ...getLocal,
                  layout: getLayout,
                  focusedHost: initialFocusedHost,
                })
              } else {
                setLocalStorage('VMHostsPage', {...getLocal, layout: getLayout})
              }
            }
          })
        }}
        isEventStopPropagation={true}
        isButtonLeaveHide={true}
        isHideText={true}
        square={true}
      />
    ) : null
  }

  const removeOpenNodes = (host: string) => {
    const getLocal: VMHostsPageLocalStorage = getLocalStorage('VMHostsPage')
    const {openNodes: getOpenNodes} = getLocal

    const remove = _.filter(
      getOpenNodes,
      openNode => openNode?.split('/')[0] !== host
    )

    setOpenNodes(remove)
  }

  const makeTreeMenuVCenterInfo = (
    props: reducerVSphere['vspheres']['host']
  ) => {
    if (!props.nodes) {
      return {
        [props.host]: {
          isPause: props.isPause,
          setIcon: 'icon-margin-right-03 vsphere-icon-vcenter',
          buttons: [
            updateBtn(props.id),
            removeBtn(props.id, props.host),
            intervalCallOnOffBtn(props.isPause, props.id, props.host),
          ],
          label: props.host,
          key: props.host,
          index: 0,
          level: 0,
          disabled: true,
          minion: props.minion,
          nodes: {},
        },
      }
    }

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
    let vcMinionValue: {
      datacenters: ResponseDatacenter[]
      vcenter: string
    }[] = Object.values(vCenterData.return[0])
    let vcIpAddress = props.host

    let vcenter: {[x: string]: VCenter} = [vCenterData].reduce(
      acc => {
        const datacenters: ResponseDatacenter[] = vcMinionValue[0]?.datacenters
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
            setIcon: 'icon-margin-right-03 vsphere-icon-datacenter',
            type: VMRole.datacenter,
            parent_name: vcIpAddress,
            parent_chart_field: VMRole.vcenter,
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
              setIcon: 'icon-margin-right-03 vsphere-icon-cluster',
              type: VMRole.cluster,
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
                setIcon: 'icon-margin-right-03 vsphere-icon-host',
                type: VMRole.host,
                parent_type: VMRole.cluster,
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
                  setIcon: classnames('icon-margin-right-03', {
                    'vsphere-icon-vm': vm.power_state === 'poweredOff',
                    'vsphere-icon-vm-on': vm.power_state === 'poweredOn',
                  }),
                  type: VMRole.vm,
                  parent_name: `${vcIpAddress}/${datacenterName}/${clusterName}/${hostName}`,
                  parent_chart_field: 'vcenter/dcname/clustername/esxhostname',
                  minion: minionName[0],
                  id: props.id,
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
              setIcon: 'icon-margin-right-03 vsphere-icon-host',
              type: VMRole.host,
              parent_type: VMRole.datacenter,
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
                setIcon: classnames('icon-margin-right-03', {
                  'vsphere-icon-vm': vm.power_state === 'poweredOff',
                  'vsphere-icon-vm-on': vm.power_state === 'poweredOn',
                }),
                type: VMRole.vm,
                id: props.id,
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
          key: vcIpAddress,
          index: 0,
          level: 0,
          type: VMRole.vcenter,
          minion: minionName[0],
          nodes: {},
        },
      }
    )

    if (!vcenter) return
    vcenter[vcIpAddress] = {
      ...vcenter[vcIpAddress],
      isPause: props.isPause,
      setIcon: 'icon-margin-right-03 vsphere-icon-vcenter',
      buttons: [
        updateBtn(props.id),
        removeBtn(props.id, props.host),
        intervalCallOnOffBtn(props.isPause, props.id, props.host),
      ],
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
    const cellName = cell.i.split('-')[1]
    switch (cellName) {
      case VMRole.vcenter: {
        try {
          let item: Item = vCenters[focusedHost.key] || null

          return (
            <VcenterTable
              isEditable={true}
              cellTextColor={cellTextColor}
              cellBackgroundColor={cellBackgroundColor}
              item={item}
            />
          )
        } catch (error) {
          console.log(error)
        }
      }
      case 'charts': {
        try {
          return (
            <ChartsLayoutRenderer
              source={source}
              timeRange={timeRange}
              manualRefresh={manualRefresh}
              isEditable={true}
              cellTextColor={cellTextColor}
              cellBackgroundColor={cellBackgroundColor}
              focusedHost={focusedHost}
            />
          )
        } catch (error) {
          console.log(error)
        }
      }

      case 'datacenters': {
        try {
          let items: VMDatacenter[] = []
          if (focusedHost.type === VMRole.vcenter) {
            items = _.filter(
              vCenters[focusedHost.key.split('/')[0]].nodes,
              k => k.type === VMRole.datacenter
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
        } catch (error) {
          console.log(error)
        }
      }
      case VMRole.datacenter: {
        try {
          let item: VMDatacenter = null

          if (focusedHost.type === VMRole.datacenter) {
            item =
              vCenters[focusedHost.key.split('/')[0]].nodes[
                focusedHost.key.split('/')[1]
              ]
          }

          return (
            <DatacenterTable
              isEditable={true}
              cellTextColor={cellTextColor}
              cellBackgroundColor={cellBackgroundColor}
              item={item}
            />
          )
        } catch (error) {
          console.log(error)
        }
      }
      case 'datastores': {
        try {
          let items: Item[] = []
          if (focusedHost.type === VMRole.datacenter) {
            items =
              vCenters[focusedHost.key.split('/')[0]].nodes[focusedHost.label]
                .datastores
          } else if (focusedHost.type === VMRole.cluster) {
            items =
              vCenters[focusedHost.key.split('/')[0]].nodes[
                focusedHost.key.split('/')[1]
              ].nodes[focusedHost.label].datastores
          }
          return (
            <DatastoresTable
              isEditable={true}
              cellTextColor={cellTextColor}
              cellBackgroundColor={cellBackgroundColor}
              items={items}
            />
          )
        } catch (error) {
          console.log(error)
        }
      }
      case 'clusters': {
        try {
          let items: Item[] = []
          if (focusedHost.type === VMRole.datacenter) {
            const splitedActiveKey = focusedHost.key.split('/')
            items = _.filter(
              vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes,
              (k: VMCluster | VMHost) => k.type === VMRole.cluster
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
        } catch (error) {
          console.log(error)
        }
      }
      case VMRole.cluster: {
        try {
          let item: VMCluster = null

          if (focusedHost.type === VMRole.cluster) {
            const splitedActiveKey = focusedHost.key.split('/')
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
        } catch (error) {
          console.log(error)
        }
      }
      case 'vmhosts': {
        try {
          let items: Item[] = []
          const splitedActiveKey = focusedHost.key.split('/')
          if (focusedHost.type === VMRole.cluster) {
            items = _.filter(
              vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
                focusedHost.label
              ].nodes,
              (k: VMHost) => k.type === VMRole.host
            )
          } else if (focusedHost.type === VMRole.datacenter) {
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
        } catch (error) {
          console.log(error)
        }
      }
      case 'vmhost': {
        try {
          let item: VMHost = null

          const splitedActiveKey = focusedHost.key.split('/')
          if (focusedHost.parent_type === VMRole.cluster) {
            item =
              vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
                splitedActiveKey[2]
              ].nodes[splitedActiveKey[3]]
          } else if (focusedHost.parent_type === VMRole.datacenter) {
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
        } catch (error) {
          console.log(error)
        }
      }
      case 'vms': {
        try {
          let items: Item[] = []
          const splitedActiveKey = focusedHost.key.split('/')
          if (
            focusedHost.parent_type === VMRole.cluster &&
            focusedHost.type === VMRole.host
          ) {
            items = _.filter(
              vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
                splitedActiveKey[2]
              ].nodes[splitedActiveKey[3]].nodes,
              k => k.type === VMRole.vm
            )
          } else if (
            focusedHost.parent_type === VMRole.datacenter &&
            focusedHost.type === VMRole.host
          ) {
            items = _.filter(
              vCenters[splitedActiveKey[0]].nodes[splitedActiveKey[1]].nodes[
                splitedActiveKey[2]
              ].nodes,
              (k: VM) => k.type === VMRole.vm
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
        } catch (error) {
          console.log(error)
        }
      }
      case VMRole.vm: {
        try {
          let item: VM = null
          const splitedActiveKey = focusedHost.key.split('/')

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
              handleGetVSphereAsync={handleGetVSphereAsync}
              saltMasterUrl={saltMasterUrl}
              saltMasterToken={saltMasterToken}
            />
          )
        } catch (error) {
          console.log(error)
        }
      }
      default: {
        return null
      }
    }
  }

  const handleSelectHost = async (props: Item) => {
    let p = Array.isArray(props) ? props : [props]
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

    p[0]['key'] = p[0].parent_name + '/' + p[0].name

    setSelectMinion(p[0].minion)
    const addChartsInfoFocusedHost = await requestCharts(p[0])
    setFocusedHost(addChartsInfoFocusedHost)
    setOpenNodes([...openNodes, ...newPath])
  }

  const onClickToggle = (node: string): void => {
    const newOpenNodes = openNodes.includes(node)
      ? openNodes.filter(openNode => openNode !== node)
      : [...openNodes, node]

    setOpenNodes(newOpenNodes)
  }

  const onSelectHost = async (props: Item) => {
    setSelectMinion(props.minion)
    const addChartsInfoFocusedHost = await requestCharts(props)
    setFocusedHost(addChartsInfoFocusedHost)
  }

  const compareRedux = () => {
    let isCheck = true

    if (props.vspheres?.[address]) {
      if (props.vspheres[address]?.minion === target) {
        isCheck = false
      }
    }

    return isCheck
  }

  const threesizerDivisions = useCallback(() => {
    const [leftSize, rightSize] = proportions
    const {
      auth: {me, isUsingAuth},
    } = props
    return [
      {
        name: 'VMware Inventory',
        headerOrientation: HANDLE_VERTICAL,
        headerButtons: [
          !isUsingAuth || isUserAuthorized(me.role, EDITOR_ROLE) ? (
            <Button
              key={0}
              text={'+ Add vCenter'}
              onClick={handleOpen}
              size={ComponentSize.ExtraSmall}
            />
          ) : null,
        ],
        menuOptions: [],
        size: leftSize,
        render: () => (
          <FancyScrollbar>
            <VMTreeMenu
              data={vCenters}
              onClickItem={onSelectHost}
              onClickToggle={onClickToggle}
              activeKey={_.get(focusedHost, 'key', '')}
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
          return isVCenters &&
            !_.isEmpty(focusedHost) &&
            vCenters[focusedHost.key.split('/')[0]] &&
            _.keys(vCenters[focusedHost.key.split('/')[0]].nodes).length ? (
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
                            {
                              'grid-item--charts': _.includes(cell.i, 'charts'),
                            }
                          )}
                          style={cellstyle}
                        >
                          {CellTable({cell})}
                          <div className="dash-graph--gradient-border">
                            <div className="dash-graph--gradient-top-left" />
                            <div className="dash-graph--gradient-top-right" />
                            <div className="dash-graph--gradient-bottom-left" />
                            <div className="dash-graph--gradient-bottom-right" />
                          </div>
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
  }, [
    vCenters,
    openNodes,
    layout,
    proportions,
    focusedHost,
    timeRange,
    manualRefresh,
  ])

  return (
    <div className="vm-status-page__container">
      <Threesizer
        orientation={HANDLE_VERTICAL}
        divisions={threesizerDivisions()}
        onResize={handleResize}
      />
      <HostModal
        isVisible={isModalVisible}
        headingTitle={isUpdate ? 'Update vCenter' : 'Connection vCenter'}
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
            isDisabled={vspheres.status === VcenterStatus.Request}
            handleChangeTarget={handleChangeTarget}
            handleChangeAddress={handleChangeAddress}
            handleChangePort={handleChangePort}
            handleChangeUser={handleChangeUser}
            handleChangePassword={handleChangePassword}
            handleChangeProtocol={handleChangeProtocol}
            handleChangeInterval={handleChangeInterval}
          />
        }
        confirmText={isUpdate ? 'Update vCenter' : 'Add vCenter'}
        confirmButtonStatus={
          vspheres.status === VcenterStatus.Request
            ? ComponentStatus.Loading
            : address &&
              user &&
              password &&
              protocol &&
              target !== MINION_LIST_EMPTY &&
              compareRedux()
            ? ComponentStatus.Default
            : ComponentStatus.Disabled
        }
      />
      {vspheres.status === VcenterStatus.Request && !isModalVisible && (
        <div className={`vm-page-spinner-container`}>
          <PageSpinner />
          <div className={`vm-page-spinner-overay`} />
        </div>
      )}
    </div>
  )
}

const mapStateToProps = ({auth, links: {addons}, vspheres}) => {
  return {
    auth,
    addons,
    vspheres,
  }
}

const mapDispatchToProps = {
  handleGetMinionKeyAcceptedList: getMinionKeyAcceptedListAsync,
  handleGetVSphereInfoSaltApi: getVSphereInfoSaltApiAsync,
  handleGetTicketRemoteConsoleAsync: getTicketRemoteConsoleAsync,
  handleAddVCenterAsync: addVCenterAsync,
  handleUpdateVSphereAsync: updateVSphereAsync,
  handleAddVcenterAction: addVcenterAction,
  handleDeleteVSphere: deleteVSphereAsync,
  handleGetVSphereAsync: getVSphereAsync,
  handleUpdateVcenterAction: updateVcenterAction,
  handleRequestAction: RequestVcenterAction,
  handleResponseAction: ResponseVcenterAction,
  handleRequestPauseVcenterAction: RequestPauseVcenterAction,
  handleRequestRunVcenterAction: RequestRunVcenterAction,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(React.memo(VMHostsPage))
