import _ from 'lodash'
import {getLocalHttpQuery} from 'src/shared/apis/saltStack'

//type
import {
  OncueService,
  ProtocolModule,
  DeviceConnection,
  Connection,
} from 'src/addon/128t/types'

export const getOncueServiceStatus = async (
  pUrl: string,
  pToken: string,
  pAssetId: string
): Promise<OncueService> => {
  const url = 'http://localhost:8900'

  const info = await Promise.all([
    getLocalHttpQuery(
      pUrl,
      pToken,
      pAssetId,
      url + '/oncue/0.5/oncue-suite/oncue-service-resource/monitoring',
      'GET'
    ),
    getLocalHttpQuery(
      pUrl,
      pToken,
      pAssetId,
      url + '/oncue/0.5/oncue-suite/oncue-service/monitoring',
      'GET'
    ),
    getLocalHttpQuery(
      pUrl,
      pToken,
      pAssetId,
      url + '/oncue/0.5/oncue-suite/protocol-modules/monitoring',
      'GET'
    ),
  ])

  if (Object.keys(info[0].data.return[0]).length > 0) {
    let oncueService: OncueService = {
      name: JSON.parse(info[1].data.return[0][pAssetId].body).info[0][
        'oncue-service'
      ].name,
      version: JSON.parse(info[1].data.return[0][pAssetId].body).info[0][
        'oncue-service'
      ].version,
      status: JSON.parse(info[1].data.return[0][pAssetId].body).info[0][
        'oncue-service'
      ].status,
      listeningPort: JSON.parse(info[1].data.return[0][pAssetId].body).info[0][
        'oncue-service'
      ]['listening-port'],
      runningThread: JSON.parse(info[1].data.return[0][pAssetId].body).info[0][
        'oncue-service'
      ]['running-thread-count'],
      processDataCount: JSON.parse(info[1].data.return[0][pAssetId].body)
        .info[0]['oncue-service']['processing-data-count'],
      processSpeed: JSON.parse(info[1].data.return[0][pAssetId].body).info[0][
        'oncue-service'
      ]['processing-speed'],
    }

    if (Object.keys(info[0].data.return[0]).length > 0) {
      oncueService = {
        ...oncueService,
        cpuUsage: JSON.parse(info[0].data.return[0][pAssetId].body).info[0][
          'oncue-service-resources'
        ].cpu.usage,
        memoryUsage: JSON.parse(info[0].data.return[0][pAssetId].body).info[0][
          'oncue-service-resources'
        ].memory.usage,
        diskUsage: JSON.parse(info[0].data.return[0][pAssetId].body).info[0][
          'oncue-service-resources'
        ].queue.usage,
      }
    }

    if (Object.keys(info[2].data.return[0]).length > 0) {
      const protocolModule: ProtocolModule[] = []

      for (const k of JSON.parse(info[2].data.return[0][pAssetId].body).info[0][
        'protocol-modules'
      ]) {
        protocolModule[k['protocol-module'].name] = {
          name: k['protocol-module'].name,
          version: k['protocol-module'].version,
          status: k['protocol-module'].Status,
        }

        const deviceConnection: DeviceConnection[] = []
        for (const d of k['protocol-module']['device-connections']) {
          deviceConnection[d.url] = {
            url: d.url,
          }

          const connection: Connection[] = []
          for (const c of d['connections']) {
            connection[c['path-id']] = {
              pathId: c['path-id'],
              connected: c['status'].connected,
              disconnected: c['status'].disconnected,
              inUse: c['status']['in use'],
              processDataCount: c['processing-data-count'],
              processSpeed: c['processing-speed'],
            }
          }

          deviceConnection[d.url] = {
            ...deviceConnection[d.url],
            connection: _.values(connection),
          }
        }

        protocolModule[k['protocol-module'].name] = {
          ...protocolModule[k['protocol-module'].name],
          deviceConnection: _.values(deviceConnection),
        }
      }

      oncueService = {
        ...oncueService,
        protocolModule: _.values(protocolModule),
      }
    }
    return oncueService
  } else {
    return null
  }
}
