// Library
import React, {PureComponent} from 'react'
import _ from 'lodash'
import yaml from 'js-yaml'
// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import TopologyDetails from 'src/hosts/components/TopologyDetails'
// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'
import {Radio} from 'src/reusable_ui'
import {Controlled as ReactCodeMirror} from 'react-codemirror2'

interface Props {
  res?: string
}

interface State {
  activeEditorTab: 'TABLE' | 'DETAILS'
}

@ErrorHandling
class AgentMinionsConsole extends PureComponent<Props, State> {
  state: State = {
    activeEditorTab: 'TABLE',
  }

  handleActiveEditorTab = (tab: 'TABLE' | 'DETAILS') => {
    this.setState({activeEditorTab: tab})
  }

  render() {
    const {activeEditorTab} = this.state
    const {res} = this.props
    const options = {
      tabIndex: 1,
      readonly: false,
      lineNumbers: false,
      autoRefresh: true,
      completeSingle: false,
      lineWrapping: true,
      mode: 'yaml',
      theme: 'yaml',
    }

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
              defaultlanguage: saltInfo?.locale_info?.defaultlanguage ?? '-',
              defaultencoding: saltInfo?.locale_info?.defaultencoding ?? '-',
              detectedencoding: saltInfo?.locale_info?.detectedencoding ?? '-',
              timezone: saltInfo?.locale_info?.timezone ?? '-',
            },
          },
          Security: {
            name: 'host',
            role: 'table',
            data: {
              selinux: saltInfo?.selinux ?? '-',
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
          <div className="gpu-monitoring-detail-header radio-buttons radio-buttons--default radio-buttons--sm">
            <Radio.Button
              id="details-tab-TABLE"
              titleText="Table"
              value="TABLE"
              active={activeEditorTab === 'TABLE'}
              onClick={() => this.handleActiveEditorTab('TABLE')}
            >
              <span className="gpu-monitoring-detail-header-title">Table</span>
            </Radio.Button>

            <Radio.Button
              id="details-tab-DETAILS"
              titleText="Details"
              value="DETAILS"
              active={activeEditorTab === 'DETAILS'}
              onClick={() => this.handleActiveEditorTab('DETAILS')}
            >
              <span className="gpu-monitoring-detail-header-title">
                Details
              </span>
            </Radio.Button>
          </div>
        </div>

        <div className="panel-body" style={{position: 'relative'}}>
          {activeEditorTab === 'TABLE' && (
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
          )}

          {activeEditorTab === 'DETAILS' && (
            <ReactCodeMirror
              value={typeof res === 'string' ? res : yaml.dump(res)}
              options={options}
              onBeforeChange={this.beforeChange}
              onTouchStart={this.onTouchStart}
            />
          )}
        </div>
      </div>
    )
  }

  private beforeChange = (): void => {}
  private onTouchStart = (): void => {}
}

export default AgentMinionsConsole
