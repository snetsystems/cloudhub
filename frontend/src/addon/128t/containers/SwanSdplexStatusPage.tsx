// Libraries
import _ from 'lodash'
import React, {useState, useEffect} from 'react'
import {useQuery} from '@apollo/react-hooks'

// Components
import GridLayoutRenderer from 'src/addon/128t/components/GridLayoutRenderer'
import PageSpinner from 'src/shared/components/PageSpinner'
import {Page} from 'src/reusable_ui'

// Types
import {Router, TopSource, TopSession} from 'src/addon/128t/types'

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

interface Variables {
  startTime: string
  endTime: string
}

interface EmitData {
  routers: Router[]
}

const SwanSdplexStatusPage = () => {
  let assetId: string = ''
  let getCellsLayout: cellLayoutInfo[] = []
  const initCellsLayout = [
    {
      i: 'routers',
      x: 0,
      y: 0,
      w: 12,
      h: 3,
    },
    {
      i: 'googleMaps',
      x: 0,
      y: 3,
      w: 12,
      h: 4,
    },
    {
      i: 'topSources',
      x: 0,
      y: 7,
      w: 5,
      h: 4,
    },
    {
      i: 'topSessions',
      x: 6,
      y: 7,
      w: 7,
      h: 4,
    },
  ]

  verifyLocalStorage(getLocalStorage, setLocalStorage, 'addon', {
    T128: {
      focusedAssetId: '',
      cellsLayoutInfo: initCellsLayout,
    },
  })

  const addon = getLocalStorage('addon')
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
    pollInterval: 5000,
  })

  useEffect(() => {
    if (data) {
      const nodes: Node[] = _.get(data, 'allRouters.nodes')
      if (nodes) {
        const emits = _.reduce(
          nodes,
          (emits: EmitData, node: Node) => {
            let router: Router = {
              assetId: node.name,
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

  const handleUpdatePosition = (layout: cellLayoutInfo[]): void => {
    setCellsLayoutInfo(layout)
  }

  return (
    <Page className="hosts-list-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="128T/SDPlex - Status" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <button
            onClick={() => setCellsLayoutInfo(initCellsLayout)}
            className="button button-sm button-default"
          >
            reset
          </button>
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents
        scrollable={true}
        className={'swan-sdpldex-status-page__container'}
      >
        {loading || _.isEmpty(emitData.routers) ? (
          <PageSpinner />
        ) : (
          <GridLayoutRenderer
            focusedAssetId={focusedAssetId}
            isSwanSdplexStatus={true}
            onClickTableRow={handleClickTableRow}
            routersData={emitData.routers}
            topSessionsData={topSessions}
            topSourcesData={topSources}
            onPositionChange={handleUpdatePosition}
            layout={cellsLayoutInfo}
          />
        )}
      </Page.Contents>
    </Page>
  )
}

export default SwanSdplexStatusPage
