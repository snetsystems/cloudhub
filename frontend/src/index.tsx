import 'babel-polyfill'

import React, {PureComponent} from 'react'
import {render} from 'react-dom'
import {Provider as ReduxProvider} from 'react-redux'
import {Provider as UnstatedProvider} from 'unstated'
import {Router, Route, useRouterHistory} from 'react-router'
import {createHistory} from 'history'
import {syncHistoryWithStore} from 'react-router-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

import configureStore from 'src/store/configureStore'
import {loadLocalStorage} from 'src/localStorage'

import {getRootNode} from 'src/utils/nodes'
import {getBasepath} from 'src/utils/basepath'

import App from 'src/App'
import {
  Login,
  UserIsAuthenticated,
  UserIsNotAuthenticated,
  Purgatory,
} from 'src/auth'
import CheckSources from 'src/CheckSources'
import {StatusPage} from 'src/status'
import DataExplorerPage from 'src/data_explorer'
import {DashboardsPage, DashboardPage} from 'src/dashboards'
import {HostsPage, HostPage} from 'src/hosts'
import {Applications} from 'src/applications'
import {LogsPage} from 'src/logs'
import AlertsApp from 'src/alerts'
import {
  KapacitorPage,
  KapacitorRulePage,
  KapacitorRulesPage,
  TickscriptPage,
} from 'src/kapacitor'
import {AdminCloudHubPage, AdminInfluxDBPage} from 'src/admin'
import {ManageSources, OnboardingWizard} from 'src/sources'
import {AgentAdminPage} from 'src/agent_admin'
import {GraphqlProvider} from 'src/addon/128t'

import NotFound from 'src/shared/components/NotFound'
import PageSpinner from 'src/shared/components/PageSpinner'

import {getLinksAsync} from 'src/shared/actions/links'
import {getMeAsync} from 'src/shared/actions/auth'
import {
  getVSpheresAsync,
  updateVcenterAction,
  updateVcentersAction,
} from 'src/hosts/actions'

// Actions
import {disablePresentationMode} from 'src/shared/actions/app'
import {errorThrown} from 'src/shared/actions/errors'
import {notify} from 'src/shared/actions/notifications'
import {
  getVSphereInfoSaltApiAsync,
  ActionTypes as vmHostActionType,
} from 'src/hosts/actions'

import 'src/style/cloudhub.scss'

import {HEARTBEAT_INTERVAL} from 'src/shared/constants'

import * as ErrorsModels from 'src/types/errors'

import {AddonType} from 'src/shared/constants'
import {Addon} from 'src/types/auth'

const errorsQueue = []

const rootNode = getRootNode()

const basepath = getBasepath()

declare global {
  interface Window {
    basepath: string
  }
}

// Older method used for pre-IE 11 compatibility
window.basepath = basepath

const browserHistory = useRouterHistory(createHistory)({
  basename: basepath, // this is written in when available by the URL prefixer middleware
})

const store = configureStore(loadLocalStorage(errorsQueue), browserHistory)
const {dispatch} = store

browserHistory.listen(() => {
  dispatch(disablePresentationMode())
})

window.addEventListener('keyup', event => {
  const escapeKeyCode = 27
  // fallback for browsers that don't support event.key
  if (event.key === 'Escape' || event.keyCode === escapeKeyCode) {
    dispatch(disablePresentationMode())
  }
})

const history = syncHistoryWithStore(browserHistory, store)

interface State {
  ready: boolean
}

class Root extends PureComponent<{}, State> {
  private getLinks = bindActionCreators(getLinksAsync, dispatch)
  private getMe = bindActionCreators(getMeAsync, dispatch)
  private getVSpheres = bindActionCreators(getVSpheresAsync, dispatch)
  private handleUpdateVcenter = bindActionCreators(
    updateVcenterAction,
    dispatch
  )
  private handleUpdateVcenters = bindActionCreators(
    updateVcentersAction,
    dispatch
  )
  private handleGetVSphereInfoSaltApi = bindActionCreators(
    getVSphereInfoSaltApiAsync,
    dispatch
  )
  private heartbeatTimer: number

  private timeout: {
    [name: string]: {id: number; host: string; timer: number; timeout: number}
  } = {}

  constructor(props) {
    super(props)
    this.state = {
      ready: false,
    }
  }

  public async componentWillMount() {
    this.flushErrorsQueue()

    try {
      await this.getLinks()
      await this.checkAuth()
      await this.checkVSpheres()

      this.setState({ready: true})
    } catch (error) {
      dispatch(errorThrown(error))
    }
  }

  public componentWillUnmount() {
    this.unsubscribe()
    clearTimeout(this.heartbeatTimer)
    _.forEach(_.keys(this.timeout), key => {
      clearInterval(this.timeout[key].timeout)
    })
  }

  public render() {
    return this.state.ready ? (
      <ReduxProvider store={store}>
        <UnstatedProvider>
          <Router history={history}>
            <Route path="/" component={UserIsAuthenticated(CheckSources)} />
            <Route path="/login" component={UserIsNotAuthenticated(Login)} />
            <Route
              path="/purgatory"
              component={UserIsAuthenticated(Purgatory)}
            />
            <Route
              path="/sources/new"
              component={UserIsAuthenticated(OnboardingWizard)}
            />
            <Route
              path="/sources/:sourceID"
              component={UserIsAuthenticated(App)}
            >
              <Route component={CheckSources}>
                <Route path="status" component={StatusPage} />
                <Route path="visualize" component={DataExplorerPage} />
                <Route path="dashboards" component={DashboardsPage} />
                <Route
                  path="dashboards/:dashboardID"
                  component={DashboardPage}
                />
                <Route
                  path="infrastructure"
                  component={props => (
                    <HostsPage
                      {...props}
                      handleClearTimeout={this.handleClearTimeout}
                    />
                  )}
                />
                <Route path="infrastructure/:hostID" component={HostPage} />
                <Route path="applications" component={Applications} />
                <Route path="alerts" component={AlertsApp} />
                <Route path="alert-rules" component={KapacitorRulesPage} />
                <Route
                  path="alert-rules/:ruleID"
                  component={KapacitorRulePage}
                />
                <Route path="alert-rules/new" component={KapacitorRulePage} />
                <Route path="logs" component={LogsPage} />
                <Route path="tickscript/new" component={TickscriptPage} />
                <Route path="tickscript/:ruleID" component={TickscriptPage} />
                <Route path="kapacitors/new" component={KapacitorPage} />
                <Route path="kapacitors/:id/edit" component={KapacitorPage} />
                <Route
                  path="kapacitors/:id/edit:hash"
                  component={KapacitorPage}
                />
                <Route
                  path="admin-cloudhub/:tab"
                  component={AdminCloudHubPage}
                />
                <Route
                  path="admin-influxdb/:tab"
                  component={AdminInfluxDBPage}
                />
                <Route path="manage-sources" component={ManageSources} />
                <Route path="agent-admin/:tab" component={AgentAdminPage} />
                <Route
                  path="add-on/swan-status"
                  component={props => {
                    return (
                      <GraphqlProvider
                        {...props}
                        page={'SwanSdplexStatusPage'}
                      />
                    )
                  }}
                />
                <Route
                  path="add-on/swan-setting"
                  component={() => {
                    return <GraphqlProvider page={'SwanSdplexSettingPage'} />
                  }}
                />
              </Route>
            </Route>
            <Route path="*" component={NotFound} />
          </Router>
        </UnstatedProvider>
      </ReduxProvider>
    ) : (
      <PageSpinner />
    )
  }

  private async performHeartbeat({shouldResetMe = false} = {}) {
    await this.getMe({shouldResetMe})

    this.heartbeatTimer = window.setTimeout(() => {
      if (store.getState().auth.me !== null) {
        this.performHeartbeat()
      }
    }, HEARTBEAT_INTERVAL)
  }

  private getSaltAddon = (): Addon => {
    const {
      links: {addons},
    } = store.getState()

    const addon = addons.find((addon: Addon) => {
      return addon.name === AddonType.salt
    })

    return addon
  }

  private promiseGenerator = async (salt, vsphere) => {
    const {url, token} = salt
    const {minion, host, username, password, port, protocol} = vsphere

    return await this.handleGetVSphereInfoSaltApi(
      url,
      token,
      minion,
      host,
      username,
      password,
      port,
      protocol
    )
  }

  private unsubscribe = store.subscribe(() => {
    // must change -> vsphere use check && multi-tenant check
    if (true && true) {
      const lastAction = store.getState().lastAction

      if (lastAction.type === vmHostActionType.LoadVcenters) {
        const vSpheres = lastAction.payload

        if (vSpheres && _.keys(vSpheres).length < 0) return

        const salt = this.getSaltAddon()

        const promises: Promise<any>[] = _.map(
          _.keys(vSpheres),
          async (key: string) => {
            return await this.promiseGenerator(salt, vSpheres[key])
          }
        )

        try {
          Promise.allSettled(promises)
            .then(async data => {
              const succesData = _.filter(
                data,
                d => d.status === 'fulfilled' && d.value
              )
              if (succesData.length === 0) return
              const values = _.map(succesData, (s: any) => s.value)
              const updateVcenters = _.map(values, value => {
                const minion = _.keys(value.return[0])[0]
                const host = value.return[0][minion]['vcenter']
                return {
                  minion,
                  host,
                  nodes: value,
                }
              })

              await this.handleUpdateVcenters(updateVcenters)
            })
            .catch(err => {
              console.error('err: ', err)
            })
        } catch (error) {
          console.error(error)
          dispatch(errorThrown(error))
        }
      }

      if (lastAction.type === vmHostActionType.AddVcenter) {
        const {id, host} = lastAction.payload[_.keys(lastAction.payload)[0]]
        this.checkTimeout(id, host)
      }

      if (lastAction.type === vmHostActionType.UpdateVcenters) {
        this.checkTimeout()
      }

      if (lastAction.type === vmHostActionType.UpdateVcenter) {
        const {id, host} = lastAction.payload
        this.checkTimeout(id, host)
      }
    }
  })

  private checkTimeout = (id?: number, host?: string) => {
    const {vspheres} = store.getState()
    const vSpheresKeys = _.keys(vspheres)
    const salt = this.getSaltAddon()

    if (host && id > -1) {
      vSpheresKeys.forEach(async key => {
        if (this.timeout[key]) {
          if (this.timeout[key].id === id) {
            this.handleClearTimeout(key)
            await this.requestVSphere(host, salt, vspheres[host])
          }
        } else {
          await this.requestVSphere(host, salt, vspheres[host])
        }
      })
    } else {
      vSpheresKeys.forEach(async (key: string) => {
        const vSphere = vspheres[key]
        if (!this.timeout[key]) {
          await this.requestVSphere(key, salt, vSphere)
        }
      })
    }
  }

  private handleClearTimeout = (key: string) => {
    window.clearTimeout(this.timeout[key].timeout)
    delete this.timeout[key]
  }

  private async requestVSphere(key: string, salt: any, vsphere: any) {
    const {interval, id} = vsphere

    this.timeout[key] = {
      id,
      host: key,
      timer: interval,
      timeout: window.setTimeout(async () => {
        if (store.getState().vspheres[key] !== null) {
          const {url, token} = salt
          const {minion, host, username, password, port, protocol} = vsphere

          const getVsphere = await this.handleGetVSphereInfoSaltApi(
            url,
            token,
            minion,
            host,
            username,
            password,
            port,
            protocol
          )

          await this.handleUpdateVcenter({host: key, nodes: getVsphere})
          this.requestVSphere(key, salt, vsphere)
        }
      }, interval),
    }
  }

  private checkVSpheres = async () => {
    // must change -> vsphere use check && multi-tenant check
    try {
      await this.getVSpheres()
    } catch (error) {
      dispatch(errorThrown(error))
    }
  }

  private flushErrorsQueue() {
    if (errorsQueue.length) {
      errorsQueue.forEach(error => {
        if (typeof error === 'object') {
          dispatch(notify(error))
        } else {
          dispatch(
            errorThrown(
              {status: 0, auth: null},
              error,
              ErrorsModels.AlertType.Warning
            )
          )
        }
      })
    }
  }

  private async checkAuth() {
    try {
      await this.performHeartbeat({shouldResetMe: true})
    } catch (error) {
      dispatch(errorThrown(error))
    }
  }
}

if (rootNode) {
  render(<Root />, rootNode)
}
