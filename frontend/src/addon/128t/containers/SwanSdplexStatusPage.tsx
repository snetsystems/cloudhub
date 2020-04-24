// Libraries
import _ from 'lodash'
import React, {useState, useEffect} from 'react'
import {useQuery} from '@apollo/react-hooks'

// Container Components
import GridLayoutRenderer from 'src/addon/128t/containers/GridLayoutRenderer'
import TopologyRanderer from 'src/addon/128t/containers/TopologyRanderer'

// Components
import RouterSourceIndicator from 'src/addon/128t/components/RouterSourceIndicator'
import ResetLayoutTips from 'src/addon/128t/components/ResetLayoutTips'
import PageSpinner from 'src/shared/components/PageSpinner'
import {Page, Radio, ButtonShape} from 'src/reusable_ui'

// Types
import {Router, TopSource, TopSession} from 'src/addon/128t/types'
import {Addon} from 'src/types/auth'

// Middleware
import {
  verifyLocalStorage,
  setLocalStorage,
  getLocalStorage,
} from 'src/shared/middleware/localStorage'

// Const
import {GET_ALLROUTERS_INFO} from 'src/addon/128t/constants'

export interface cellLayoutInfo {
  i: string
  x: number
  y: number
  w: number
  h: number
}

interface Response {
  data: {
    allRouters: {
      nodes: Node[]
    }
  }
}

interface Node {
  name: string
  locationCoordinates: string
  managementConnected: boolean
  bandwidth_avg: number
  session_arrivals: number
  nodes: {
    nodes: NodeDetail[]
  }
  topSources: TopSource[]
  topSessions: TopSession[]
}

interface NodeDetail {
  assetId: string
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
  startTime: string
  endTime: string
}

interface EmitData {
  routers: Router[]
}

const SwanSdplexStatusPage = ({addons}: {addons: Addon[]}) => {
  let assetId: string = ''
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
      focusedAssetId: '',
      cellsLayoutInfo: initCellsLayout,
    },
  }

  verifyLocalStorage(
    getLocalStorage,
    setLocalStorage,
    'addon',
    inputLocalStorageInitData
  )

  let addon = getLocalStorage('addon')
  const check = addon.T128.hasOwnProperty('cellsLayoutInfo')

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
    assetId = _.get(addon, 'T128.focusedAssetId')
    getCellsLayout = _.get(addon, 'T128.cellsLayoutInfo')
  }

  const [focusedAssetId, setFocusedAssetId] = useState<string>(assetId)
  const [emitData, setRoutersInfo] = useState<EmitData>({
    routers: [],
  })

  const [topSources, setTopSources] = useState<TopSource[]>([])
  const [topSessions, setTopSessions] = useState<TopSession[]>([])
  const [cellsLayoutInfo, setCellsLayoutInfo] = useState<cellLayoutInfo[]>(
    getCellsLayout
  )

  const {loading, data} = useQuery<Response, Variables>(GET_ALLROUTERS_INFO, {
    // variables: {
    //   startTime: '2019-11-26T02:00:00',
    //   endTime: '2019-11-26T02:01:00',
    // },
    errorPolicy: 'all',
    pollInterval: 50000,
  })

  const [activeEditorTab, setActiveEditorTab] = useState<string>('Topology')

  useEffect(() => {
    if (data) {
      const nodes: Node[] = _.get(data, 'allRouters.nodes')
      if (nodes) {
        const emits = _.reduce(
          nodes,
          (emits: EmitData, node: Node) => {
            let router: Router = {
              name: node.name,
              locationCoordinates: node.locationCoordinates,
              managementConnected: node.managementConnected,
              bandwidth_avg: node.bandwidth_avg,
              session_arrivals: node.session_arrivals,
              topSources: node.topSources,
              topSessions: node.topSessions
                ? node.topSessions.map(topSession => ({
                    ...topSession,
                    value: Number(topSession.value),
                  }))
                : [],
            }

            const nodeDetail: NodeDetail = _.head(node.nodes.nodes)
            if (nodeDetail) {
              try {
                router = {
                  ...router,
                  assetId: _.get(nodeDetail, 'assetId'),
                  enabled: _.get(nodeDetail, 'enabled'),
                  role: _.get(nodeDetail, 'role'),
                  startTime: _.get(nodeDetail, 'state.startTime'),
                  softwareVersion: _.get(nodeDetail, 'state.softwareVersion'),
                  memoryUsage: (() => {
                    const capacity: number = _.get(
                      nodeDetail,
                      'memory.capacity'
                    )
                    const usage: number = _.get(nodeDetail, 'memory.usage')
                    return capacity > 0 ? (usage / capacity) * 100 : null
                  })(),
                  cpuUsage: (() => {
                    const cpus: CPU[] = _.get(nodeDetail, 'cpu')
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
                    const disks: Disk[] = _.get(nodeDetail, 'disk')
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
                      nodeDetail,
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
                        f => f.name.toLowerCase().indexOf('wan') > -1
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
                      .filter(f => f.ipAddress != null)
                      .map(m => m.ipAddress)[0]
                  })(),
                }
              } catch (e) {
                console.log('node detail', e)
              }
            }

            emits.routers = [...emits.routers, router]
            return emits
          },
          {
            routers: [],
          }
        )

        setRoutersInfo(emits)

        if (focusedAssetId) {
          const router = emits.routers.find(node => {
            return node.assetId === focusedAssetId
          })
          if (router && router.topSources) setTopSources(router.topSources)
          if (router && router.topSessions) setTopSessions(router.topSessions)
        }
      }
    }
  }, [data])

  useEffect(() => {
    setLocalStorage('addon', {
      T128: {
        focusedAssetId,
        cellsLayoutInfo,
      },
    })
  }, [focusedAssetId, cellsLayoutInfo])

  const handleClickTableRow = (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => (): void => {
    if (topSources) setTopSources(topSources)
    else setTopSources([])

    if (topSessions) setTopSessions(topSessions)
    else setTopSessions([])

    setFocusedAssetId(focusedAssetId)
  }

  const handleClickMapMarker = (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => {
    if (topSources) setTopSources(topSources)
    else setTopSources([])

    if (topSessions) setTopSessions(topSessions)
    else setTopSessions([])

    setFocusedAssetId(focusedAssetId)
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
              id="deceo-tab-queries"
              titleText="Data"
              value="Data"
              active={activeEditorTab === 'Data'}
              onClick={onSetActiveEditorTab}
            >
              Data
            </Radio.Button>
            <Radio.Button
              id="deceo-tab-vis"
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
        {loading || _.isEmpty(emitData.routers) ? (
          <PageSpinner />
        ) : activeEditorTab === 'Data' ? (
          <div className={'swan-sdpldex-status-page__container'}>
            <GridLayoutRenderer
              focusedAssetId={focusedAssetId}
              isSwanSdplexStatus={true}
              onClickTableRow={handleClickTableRow}
              routersData={emitData.routers}
              topSessionsData={topSessions}
              topSourcesData={topSources}
              onPositionChange={handleUpdatePosition}
              layout={cellsLayoutInfo}
              onClickMapMarker={handleClickMapMarker}
              addons={addons}
            />
          </div>
        ) : (
          <TopologyRanderer routersData={emitData.routers} />
        )}
      </Page.Contents>
    </Page>
  )
}

export default SwanSdplexStatusPage
