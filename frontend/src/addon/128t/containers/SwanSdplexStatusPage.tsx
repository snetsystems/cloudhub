import _ from 'lodash'
import React, {useState, useEffect} from 'react'
import {useQuery} from '@apollo/react-hooks'

import {Page} from 'src/reusable_ui'

// Types
import {Router, TopSource, TopSession} from 'src/addon/128t/types'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
// import RouterModal from 'src/addon/128t/components/RouterModal'
import PageSpinner from 'src/shared/components/PageSpinner'

// table
import RouterTable from 'src/addon/128t/components/RouterTable'
import TopSourcesTable from 'src/addon/128t/components/TopSourcesTable'

//const
import {GET_ALLROUTERS_INFO} from 'src/addon/128t/constants'
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

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
  const [proportions, setProportions] = useState<Proportions>({
    proportions: [0.4, 0.6],
  })
  const [emitData, setRoutersInfo] = useState<EmitData>({
    routers: [],
  })

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
              managementConnected: node.managementConnected
                ? 'Connected'
                : 'Disconnected',
              bandwidth_avg: node.bandwidth_avg,
              session_arrivals: node.session_arrivals,
              topSources: node.topSources,
              topSessions: node.topSessions,
            }

            const nodeDetail: NodeDetail = _.head(node.nodes.nodes)
            if (nodeDetail) {
              router = {
                ...router,
                enabled: _.get(nodeDetail, 'enabled'),
                role: _.get(nodeDetail, 'role'),
                startTime: _.get(nodeDetail, 'state.startTime'),
                softwareVersion: _.get(nodeDetail, 'state.softwareVersion'),
                memoryUsage: (() => {
                  const capacity: number = _.get(nodeDetail, 'memory.capacity')
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
                    ? (rootPatitions[0].usage / rootPatitions[0].capacity) * 100
                    : null
                })(),
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
      }
    }
  }, [data])

  const horizontalDivisions = () => {
    const [topSize, bottomSize] = _.get(proportions, 'proportions')
    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: () => {
          return <RouterTable routers={emitData.routers} />
        },
        headerOrientation: HANDLE_HORIZONTAL,
        size: topSize,
      },
      {
        name: '',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: () => {
          return <TopSourcesTable topSources={emitData.routers[0].topSources} />
        },
        headerOrientation: HANDLE_HORIZONTAL,
        size: bottomSize,
      },
    ]
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
          <Threesizer
            orientation={HANDLE_HORIZONTAL}
            divisions={horizontalDivisions()}
            onResize={(sizes: number[]) => {
              setProportions({proportions: sizes})
            }}
          />
        )}
      </Page.Contents>
    </Page>
  )
}

export default SwanSdplexStatusPage
