// Libraries
import _ from 'lodash'
import React, {useState, useEffect} from 'react'
import {useQuery} from '@apollo/react-hooks'

// Container Components
import GridLayoutRenderer from 'src/addon/128t/containers/GridLayoutRenderer'
import TopologyRenderer from 'src/addon/128t/containers/TopologyRenderer'

// Components
import RouterSourceIndicator from 'src/addon/128t/components/RouterSourceIndicator'
import ResetLayoutTips from 'src/addon/128t/components/ResetLayoutTips'
import PageSpinner from 'src/shared/components/PageSpinner'
import {Page, Radio, ButtonShape} from 'src/reusable_ui'

// Types
import {
  RouterNode,
  TopSource,
  TopSession,
  PeerDetail,
  GroupRouterNodeData,
} from 'src/addon/128t/types'
import {Addon} from 'src/types/auth'

// Middleware
import {
  verifyLocalStorage,
  setLocalStorage,
  getLocalStorage,
} from 'src/shared/middleware/localStorage'

// Constants
import {GET_ALLROUTERS_INFO} from 'src/addon/128t/constants'
import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

interface HostsObject {
  [x: string]: Host
}

export interface Host {
  name: string
  deltaUptime?: number
  winDeltaUptime?: number
}

export interface cellLayoutInfo {
  i: string
  x: number
  y: number
  w: number
  h: number
}

interface Response {
  data: {
    allNodes: {
      nodes: Node[]
    }
  }
}

interface Node {
  name: string
  enabled: boolean
  role: string
  cpu: CPU[]
  memory: Memory
  disk: Disk[]
  state: {
    status: string
    startTime: string
    softwareVersion: string
  }
  deviceInterfaces: {
    nodes: NetworkInterfaces[]
  }
  router: Router
}

interface Router {
  name: string
  locationCoordinates: string
  managementConnected: boolean
  bandwidth_avg: number
  session_arrivals: number
  peers: {
    nodes: PeerDetail[]
  }
  topSources: TopSource[]
  topSessions: TopSession[]
}

interface CPU {
  core: number
  utilization: number
  type: string
}

interface Memory {
  capacity: number
  usage: number
}

interface Disk {
  capacity: number
  usage: number
  partition: string
}

interface NetworkInterfaces {
  networkInterfaces: {
    nodes: Addresses[]
  }
}

interface Addresses {
  name: string
  addresses: {
    nodes: IpAddress[]
  }
}

interface IpAddress {
  ipAddress: string
}

interface Variables {
  names: string[]
}

interface EmitData {
  routerNodes: RouterNode[]
}

interface GroupHosts {
  name: string
  hosts: HostsObject
}

const SwanSdplexStatusPage = ({
  addons,
  isUsingAuth,
  meRole,
  groupHosts,
}: {
  addons: Addon[]
  isUsingAuth: boolean
  meRole: string
  groupHosts: GroupHosts[]
}) => {
  let nodeName: string = ''
  let getCellsLayout: cellLayoutInfo[] = []
  const initCellsLayout: cellLayoutInfo[] = [
    {
      i: 'routers',
      x: 0,
      y: 0,
      w: 12,
      h: 4,
    },
    {
      i: 'leafletMap',
      x: 0,
      y: 4,
      w: 7,
      h: 8,
    },
    {
      i: 'topSources',
      x: 7,
      y: 8,
      w: 5,
      h: 4,
    },
    {
      i: 'topSessions',
      x: 7,
      y: 4,
      w: 5,
      h: 4,
    },
  ]

  const inputLocalStorageInitData = {
    T128: {
      focusedNodeName: '',
      cellsLayoutInfo: initCellsLayout,
      oncueAutoRefresh: 0,
    },
  }

  verifyLocalStorage(
    getLocalStorage,
    setLocalStorage,
    'addon',
    inputLocalStorageInitData
  )

  let addon = getLocalStorage('addon')

  const check =
    addon.hasOwnProperty('T128') || addon.T128.hasOwnProperty('cellsLayoutInfo')

  if (check) {
    let propertyCheck = addon.T128.cellsLayoutInfo.map(
      (cell: cellLayoutInfo, idx: number) =>
        cell.i === inputLocalStorageInitData.T128.cellsLayoutInfo[idx].i
    )

    if (propertyCheck.indexOf(false) > -1) {
      setLocalStorage('addon', inputLocalStorageInitData)
    }
  } else {
    setLocalStorage('addon', inputLocalStorageInitData)
  }

  addon = getLocalStorage('addon')

  if (addon) {
    nodeName = _.get(addon, 'T128.focusedNodeName')
    getCellsLayout = _.get(addon, 'T128.cellsLayoutInfo')
  }

  const [focusedNodeName, setFocusedNodeName] = useState<string>(nodeName)
  const [emitData, setRouterNodesInfo] = useState<EmitData>({
    routerNodes: [],
  })

  const [topSources, setTopSources] = useState<TopSource[]>([])
  const [topSessions, setTopSessions] = useState<TopSession[]>([])
  const [cellsLayoutInfo, setCellsLayoutInfo] = useState<cellLayoutInfo[]>(
    getCellsLayout
  )

  const gHosts: {group: string; hostName: string}[] = []
  _.values(groupHosts).map((g) =>
    _.values(g.hosts).map((h) => gHosts.push({group: g.name, hostName: h.name}))
  )

  const [groupRouterNodesData, setGroupRouterNodeData] = useState<
    GroupRouterNodeData[]
  >([
    {
      groupName: '',
      routerNodes: [],
    },
  ])

  const [activeEditorTab, setActiveEditorTab] = useState<string>('Data')

  const {loading, error, data} = useQuery<Response, Variables>(
    GET_ALLROUTERS_INFO,
    {
      variables: {
        names:
          isUsingAuth && !isUserAuthorized(meRole, SUPERADMIN_ROLE)
            ? gHosts.map((m) => m.hostName)
            : [],
      },
      errorPolicy: 'all',
      pollInterval: 10000,
    }
  )

  const groupRouter: GroupRouterNodeData[] = _.values(groupHosts).map((g) => {
    const nodeName = _.values(g.hosts).map((h) => {
      return {
        nodeName: h.name,
        deltaUptime: h.deltaUptime,
        winDeltaUptime: h.winDeltaUptime,
      }
    })
    return {
      ...groupRouter,
      groupName: g.name,
      routerNodes: nodeName,
    }
  })

  useEffect(() => {
    if (data) {
      const nodes: Node[] = _.get(data, 'allNodes.nodes')
      const groupRouterNodesData: GroupRouterNodeData[] = _.values(groupRouter)

      if (groupRouterNodesData) {
        let routerNodesData: RouterNode[] = []

        let emits = _.reduce(
          groupRouterNodesData,
          (
            emits: GroupRouterNodeData[],
            groupRouterNodeData: GroupRouterNodeData
          ) => {
            const routerNodes = _.reduce(
              groupRouterNodeData.routerNodes,
              (routerNodes: RouterNode[], groupRouterNode: RouterNode) => {
                const node: Node = nodes.find(
                  (f) => f.name === groupRouterNode.nodeName
                )
                if (node) {
                  const routerNode: RouterNode = {
                    group: groupRouterNodeData.groupName,
                    routerName: node.router.name,
                    nodeName: _.get(node, 'name'),
                    enabled: _.get(node, 'enabled'),
                    role: _.get(node, 'role'),
                    startTime: _.get(node, 'state.startTime'),
                    softwareVersion: _.get(node, 'state.softwareVersion'),
                    memoryUsage: (() => {
                      const capacity: number = _.get(node, 'memory.capacity')
                      const usage: number = _.get(node, 'memory.usage')
                      return capacity > 0 ? (usage / capacity) * 100 : null
                    })(),
                    cpuUsage: (() => {
                      const cpus: CPU[] = _.get(node, 'cpu')
                      const sum: number[] = _.reduce(
                        cpus,
                        (acc: number[], cpu: CPU) => {
                          if (cpu.type === 'packetProcessing') return acc
                          acc[0] += cpu.utilization
                          acc[1] += 1
                          return acc
                        },
                        [0, 0]
                      )
                      return sum[1] > 0 ? sum[0] / sum[1] : null
                    })(),
                    diskUsage: (() => {
                      const disks: Disk[] = _.get(node, 'disk')
                      const rootPatitions: Disk[] = _.filter(
                        disks,
                        (disk: Disk) => {
                          return disk.partition === '/'
                        }
                      )
                      if (_.isEmpty(rootPatitions)) return null

                      return rootPatitions[0].capacity > 0
                        ? (rootPatitions[0].usage / rootPatitions[0].capacity) *
                            100
                        : null
                    })(),
                    ipAddress: (() => {
                      const networkInterfaces: NetworkInterfaces[] = _.get(
                        node,
                        'deviceInterfaces.nodes'
                      )

                      const addresses: Addresses[] = _.reduce(
                        networkInterfaces,
                        (
                          addresses: Addresses[],
                          networkInterface: NetworkInterfaces
                        ) => {
                          const addressesNode: Addresses[] = _.reduce(
                            _.get(networkInterface, 'networkInterfaces.nodes'),
                            (addresses: Addresses[], value) => {
                              addresses = [...addresses, value]
                              return addresses
                            },
                            []
                          )

                          addressesNode.map((m: Addresses) => addresses.push(m))

                          return addresses
                        },
                        []
                      )

                      const ipAddress: IpAddress[] = _.reduce(
                        addresses.filter(
                          (f) => f.name.toLowerCase().indexOf('wan') > -1
                        ),
                        (ipAddress: IpAddress[], address: Addresses) => {
                          const ipAddresses: IpAddress[] = _.reduce(
                            _.get(address, 'addresses.nodes'),
                            (ipAddress: IpAddress[], value) => {
                              ipAddress = [...ipAddress, value]
                              return ipAddress
                            },
                            []
                          )
                          ipAddresses.map((m: IpAddress) => ipAddress.push(m))
                          return ipAddress
                        },
                        []
                      )

                      return ipAddress
                        .filter((f) => f.ipAddress != null)
                        .map((m) => m.ipAddress)[0]
                    })(),
                    locationCoordinates: node.router.locationCoordinates,
                    managementConnected: node.router.managementConnected,
                    bandwidth_avg: node.router.bandwidth_avg,
                    session_arrivals: node.router.session_arrivals,
                    topSources: node.router.topSources,
                    peers: node.router.peers.nodes,
                    topSessions: node.router.topSessions
                      ? node.router.topSessions.map((topSession) => ({
                          ...topSession,
                          value: Number(topSession.value),
                        }))
                      : [],
                    deltaUptime: groupRouterNode.deltaUptime,
                    winDeltaUptime: groupRouterNode.deltaUptime,
                  }

                  routerNodes = [...routerNodes, routerNode]
                  routerNodesData = [...routerNodesData, routerNode]
                }

                return routerNodes
              },
              []
            )

            emits = [
              ...emits,
              {
                groupName: groupRouterNodeData.groupName,
                routerNodes: routerNodes,
              },
            ]

            return emits
          },
          []
        )

        if (!isUsingAuth || isUserAuthorized(meRole, SUPERADMIN_ROLE)) {
          const notGroupNode: RouterNode[] = _.reduce(
            nodes,
            (routerNodes: RouterNode[], node: Node) => {
              const routeNode = routerNodesData.find(
                (f) => f.nodeName === node.name
              )
              if (routeNode === undefined) {
                const routerNode: RouterNode = {
                  group: 'root',
                  routerName: node.router.name,
                  nodeName: _.get(node, 'name'),
                  enabled: _.get(node, 'enabled'),
                  role: _.get(node, 'role'),
                  startTime: _.get(node, 'state.startTime'),
                  softwareVersion: _.get(node, 'state.softwareVersion'),
                  memoryUsage: (() => {
                    const capacity: number = _.get(node, 'memory.capacity')
                    const usage: number = _.get(node, 'memory.usage')
                    return capacity > 0 ? (usage / capacity) * 100 : null
                  })(),
                  cpuUsage: (() => {
                    const cpus: CPU[] = _.get(node, 'cpu')
                    const sum: number[] = _.reduce(
                      cpus,
                      (acc: number[], cpu: CPU) => {
                        if (cpu.type === 'packetProcessing') return acc
                        acc[0] += cpu.utilization
                        acc[1] += 1
                        return acc
                      },
                      [0, 0]
                    )
                    return sum[1] > 0 ? sum[0] / sum[1] : null
                  })(),
                  diskUsage: (() => {
                    const disks: Disk[] = _.get(node, 'disk')
                    const rootPatitions: Disk[] = _.filter(
                      disks,
                      (disk: Disk) => {
                        return disk.partition === '/'
                      }
                    )
                    if (_.isEmpty(rootPatitions)) return null

                    return rootPatitions[0].capacity > 0
                      ? (rootPatitions[0].usage / rootPatitions[0].capacity) *
                          100
                      : null
                  })(),
                  ipAddress: (() => {
                    const networkInterfaces: NetworkInterfaces[] = _.get(
                      node,
                      'deviceInterfaces.nodes'
                    )

                    const addresses: Addresses[] = _.reduce(
                      networkInterfaces,
                      (
                        addresses: Addresses[],
                        networkInterface: NetworkInterfaces
                      ) => {
                        const addressesNode: Addresses[] = _.reduce(
                          _.get(networkInterface, 'networkInterfaces.nodes'),
                          (addresses: Addresses[], value) => {
                            addresses = [...addresses, value]
                            return addresses
                          },
                          []
                        )

                        addressesNode.map((m: Addresses) => addresses.push(m))

                        return addresses
                      },
                      []
                    )

                    const ipAddress: IpAddress[] = _.reduce(
                      addresses.filter(
                        (f) => f.name.toLowerCase().indexOf('wan') > -1
                      ),
                      (ipAddress: IpAddress[], address: Addresses) => {
                        const ipAddresses: IpAddress[] = _.reduce(
                          _.get(address, 'addresses.nodes'),
                          (ipAddress: IpAddress[], value) => {
                            ipAddress = [...ipAddress, value]
                            return ipAddress
                          },
                          []
                        )
                        ipAddresses.map((m: IpAddress) => ipAddress.push(m))
                        return ipAddress
                      },
                      []
                    )

                    return ipAddress
                      .filter((f) => f.ipAddress != null)
                      .map((m) => m.ipAddress)[0]
                  })(),
                  locationCoordinates: node.router.locationCoordinates,
                  managementConnected: node.router.managementConnected,
                  bandwidth_avg: node.router.bandwidth_avg,
                  session_arrivals: node.router.session_arrivals,
                  topSources: node.router.topSources,
                  peers: node.router.peers.nodes,
                  topSessions: node.router.topSessions
                    ? node.router.topSessions.map((topSession) => ({
                        ...topSession,
                        value: Number(topSession.value),
                      }))
                    : [],
                }

                routerNodesData = [...routerNodesData, routerNode]

                routerNodes = [...routerNodes, routerNode]
              }
              return routerNodes
            },
            []
          )

          emits = [
            ...emits,
            {
              groupName: 'root',
              routerNodes: notGroupNode,
            },
          ]
        }

        setGroupRouterNodeData(emits)
        setRouterNodesInfo({routerNodes: routerNodesData})

        if (focusedNodeName) {
          const router = routerNodesData.find((node) => {
            return node.nodeName === focusedNodeName
          })
          if (router && router.topSources) setTopSources(router.topSources)
          if (router && router.topSessions) setTopSessions(router.topSessions)
        }
      }
    }
  }, [data])

  useEffect(() => {
    const addon = getLocalStorage('addon')
    setLocalStorage('addon', {
      ...addon,
      T128: {
        ...addon.T128,
        focusedNodeName,
        cellsLayoutInfo,
      },
    })
  }, [focusedNodeName, cellsLayoutInfo])

  const handleClickTableRow = (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedNodeName: string
  ) => (): void => {
    if (topSources) setTopSources(topSources)
    else setTopSources([])

    if (topSessions) setTopSessions(topSessions)
    else setTopSessions([])

    setFocusedNodeName(focusedNodeName)
  }

  const handleClickMapMarker = (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedNodeName: string
  ) => {
    if (topSources) setTopSources(topSources)
    else setTopSources([])

    if (topSessions) setTopSessions(topSessions)
    else setTopSessions([])

    setFocusedNodeName(focusedNodeName)
  }

  const handleUpdatePosition = (layout: cellLayoutInfo[]): void => {
    setCellsLayoutInfo(layout)
  }

  const onSetActiveEditorTab = (activeEditorTab: string): void => {
    setActiveEditorTab(activeEditorTab)
  }

  return (
    <Page className="hosts-list-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="SWAN/Oncue - Status" />
        </Page.Header.Left>
        <Page.Header.Center widthPixels={220}>
          <Radio shape={ButtonShape.StretchToFit}>
            <Radio.Button
              id="addon-tab-data"
              titleText="Data"
              value="Data"
              active={activeEditorTab === 'Data'}
              onClick={onSetActiveEditorTab}
            >
              Data
            </Radio.Button>
            <Radio.Button
              id="addon-tab-topology"
              titleText="Topology"
              value="Topology"
              active={activeEditorTab === 'Topology'}
              onClick={onSetActiveEditorTab}
            >
              Topology
            </Radio.Button>
          </Radio>
        </Page.Header.Center>
        <Page.Header.Right>
          <RouterSourceIndicator addons={addons} />
          {activeEditorTab === 'Data' ? (
            <button
              onClick={() => setCellsLayoutInfo(initCellsLayout)}
              className="button button-sm button-default button-square"
            >
              <ResetLayoutTips />
            </button>
          ) : (
            <></>
          )}
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents scrollable={true}>
        {(loading || _.isEmpty(emitData.routerNodes)) &&
        _.get(error, 'message') !== 'Network error: Failed to fetch' ? (
          <PageSpinner />
        ) : _.get(error, 'message') !== 'Network error: Failed to fetch' ? (
          activeEditorTab === 'Data' ? (
            <div className={'swan-sdpldex-status-page__container'}>
              <GridLayoutRenderer
                focusedNodeName={focusedNodeName}
                isSwanSdplexStatus={true}
                onClickTableRow={handleClickTableRow}
                routerNodesData={emitData.routerNodes}
                topSessionsData={topSessions}
                topSourcesData={topSources}
                onPositionChange={handleUpdatePosition}
                layout={cellsLayoutInfo}
                onClickMapMarker={handleClickMapMarker}
                addons={addons}
              />
            </div>
          ) : (
            <TopologyRenderer
              isUsingAuth={isUsingAuth}
              meRole={meRole}
              groupRouterNodesData={groupRouterNodesData}
            />
          )
        ) : (
          !!addons && (
            <p className="unexpected-error">
              <span>
                The request from CloudHub cannot be reached to SWAN/Oncue
                Conductor.
                <br />
                This may be SSL Certification issue.
                <br />
                Please, check out this linked site -&nbsp;
                <a
                  href={
                    addons.find((addon) => {
                      return addon.name === 'swan'
                    }).url
                  }
                  target="_blank"
                >
                  SWAN Conductor
                </a>
                , it could help you to resolve this issue.
              </span>
            </p>
          )
        )}
      </Page.Contents>
    </Page>
  )
}

export default SwanSdplexStatusPage
