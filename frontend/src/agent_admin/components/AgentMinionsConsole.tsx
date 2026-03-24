// Library
import React, {PureComponent} from 'react'
import _ from 'lodash'
import yaml from 'js-yaml'
// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import TopologyDetails from 'src/hosts/components/TopologyDetails'
// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  res?: string
}

@ErrorHandling
class AgentMinionsConsole extends PureComponent<Props> {
  render() {
    const {res} = this.props

    const getSaltInstanceInfo = (info: any) => {
      try {
        if (_.isEmpty(info)) return {}

        const saltInfo =
          typeof info === 'string' ? (yaml.load(info) as any) : info

        const instanceType: any = {
          System: {
            name: 'host',
            role: 'table',
            data: {
              os: saltInfo?.os ?? '-',
              os_family: saltInfo?.os_family ?? '-',
              osrelease: saltInfo?.osrelease ?? saltInfo?.osrelease ?? '-',
              kernel: saltInfo?.kernel ?? '-',
              path: saltInfo?.path ?? '-',
              localhost: saltInfo?.localhost ?? '-',
            },
          },
          Hardware: {
            name: 'host',
            role: 'table',
            data: {
              biosversion: saltInfo?.biosversion ?? '-',
              mem_total: saltInfo?.mem_total ?? '-',
              swap_total: saltInfo?.swap_total ?? '-',
              gpus: saltInfo?.gpus ?? [],
              cpuarch: saltInfo?.cpuarch ?? '-',
              cpu_model: saltInfo?.cpu_model ?? '-',
            },
          },
          Network: {
            name: 'host',
            role: 'table',
            data: {
              ip_interfaces: saltInfo?.ip_interfaces ?? {},
              ip4_gw: saltInfo?.ip4_gw ?? '-',
              ip6_gw: saltInfo?.ip6_gw ?? '-',
              dns: saltInfo?.['dns:nameservers'] ?? [],
            },
          },
          Locale: {
            name: 'host',
            role: 'table',
            data: {
              timezone: saltInfo?.timezone ?? '-',
            },
          },
          Security: {
            name: 'host',
            role: 'table',
            data: {
              selinux_state: saltInfo?.selinux_state ?? '-',
            },
          },
        }

        return instanceType
      } catch (error) {
        console.error('error parsing salt instance info: ', error)
        return {}
      }
    }

    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">Console</h2>
        </div>

        <div className="panel-body" style={{position: 'relative'}}>
          <div className="page-contents">
            {(() => {
              const mapped = getSaltInstanceInfo(res)
              const noData =
                !mapped?.System?.data?.os || mapped.System.data.os === '-'

              return noData ? (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    fontSize: '18px',
                  }}
                >
                  No Data
                </div>
              ) : (
                <FancyScrollbar style={{height: '100%'}} autoHide={false}>
                  <TopologyDetails selectInstanceData={mapped} />
                </FancyScrollbar>
              )
            })()}
          </div>
        </div>
      </div>
    )
  }
}

export default AgentMinionsConsole
