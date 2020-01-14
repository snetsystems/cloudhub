import _ from 'lodash'
import React, {useState, useEffect} from 'react'
import {useQuery} from '@apollo/react-hooks'

import {Page} from 'src/reusable_ui'

// Types
import {Router, TopSource, TopSession} from 'src/addon/128t/types'

//Middleware
import {
  setLocalStorage,
  getLocalStorage,
} from 'src/shared/middleware/localStorage'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
// import RouterModal from 'src/addon/128t/components/RouterModal'
import PageSpinner from 'src/shared/components/PageSpinner'

// table
import RouterTable from 'src/addon/128t/components/RouterTable'
import TopSourcesTable from 'src/addon/128t/components/TopSourcesTable'
import TopSessionsTable from 'src/addon/128t/components/TopSessionsTable'

//const
import {GET_ALLROUTERS_INFO} from 'src/addon/128t/constants'
import {HANDLE_VERTICAL} from 'src/shared/constants'

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

interface Proportions {
  proportions: number[]
}

const SwanSdplexStatusPage = () => {
  let [topSize, bottomSize] = [0.4, 0.6]
  let assetId = ''

  const addon = getLocalStorage('addon')
  if (addon) {
    // [topSize, bottomSize] = _.get(addon, 'T128.proportions')
    assetId = _.get(addon, 'T128.focusedAssetId')
  }

  const [proportions, setProportions] = useState<Proportions>({
    proportions: [topSize, bottomSize],
  })

  const [focusedAssetId, setFocusedAssetId] = useState<string>(assetId)

  useEffect(() => {
    return () => {
      setLocalStorage('addon', {
        T128: {
          // proportions: _.get(proportions, 'proportions'),
          focusedAssetId,
        },
      })
    }
  }, [focusedAssetId])
  //[proportions, focusedAssetId]

  const [emitData, setRoutersInfo] = useState<EmitData>({
    routers: [],
  })

  const [topSources, setTopSources] = useState<TopSource[]>([])
  const [topSessions, setTopSessions] = useState<TopSession[]>([])

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
              topSessions: node.topSessions,
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

  const verticalDivisions = () => {
    const [topSize, bottomSize] = _.get(proportions, 'proportions')

    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: () => {
          return (
            <div style={{padding: '0 15px'}}>
              <TopSourcesTable topSources={topSources} />
            </div>
          )
        },
        headerOrientation: HANDLE_VERTICAL,
        size: topSize,
      },
      {
        name: '',
        handlePixels: 5,
        headerButtons: [],
        menuOptions: [],
        render: () => {
          return (
            <div style={{padding: '0 15px'}}>
              <TopSessionsTable topSessions={topSessions} />
            </div>
          )
        },
        headerOrientation: HANDLE_VERTICAL,
        size: bottomSize,
      },
    ]
  }

  const handleClickTableRow = (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => () => {
    if (topSources) setTopSources(topSources)
    else setTopSources([])

    if (topSessions) setTopSessions(topSessions)
    else setTopSessions([])

    setFocusedAssetId(focusedAssetId)
  }

  return (
    <Page className="hosts-list-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="128T/SDPlex - Status" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true} />
      </Page.Header>
      <Page.Contents scrollable={true}>
        {loading || _.isEmpty(emitData.routers) ? (
          <PageSpinner />
        ) : (
          <div className="swan-sdpldex-status-page__container">
            <RouterTable
              routers={emitData.routers}
              focusedAssetId={focusedAssetId}
              onClickTableRow={handleClickTableRow}
            />
            <span
              className={'panel-heading-dividebar'}
              style={{
                display: 'block',
                height: '2px',
                backgroundColor: 'rgb(56,56,70)',
                flex: 'auto',
              }}
            ></span>
            <Threesizer
              orientation={HANDLE_VERTICAL}
              divisions={verticalDivisions()}
              onResize={(sizes: number[]) => {
                setProportions({proportions: sizes})
              }}
            />
          </div>
        )}
      </Page.Contents>
    </Page>
  )
}

export default SwanSdplexStatusPage
