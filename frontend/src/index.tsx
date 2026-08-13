import './init.js'
import 'babel-polyfill'
import process from 'process'
globalThis.process = process
globalThis.global = globalThis
import i18n from './i18n' // I18N initialization

import React, {PureComponent, Suspense} from 'react'
import {render} from 'react-dom'
import {Provider as ReduxProvider} from 'react-redux'
import {Redirect, Router, Route, useRouterHistory} from 'react-router'
import {createHistory, Pathname} from 'history'
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
  PasswordReset,
  UpdateUser,
  OTPLoginPage,
} from 'src/auth'
import CheckSources from 'src/CheckSources'
import OnboardingWizard from 'src/sources/containers/OnboardingWizard'

import NotFound from 'src/shared/components/NotFound'
import PageSpinner from 'src/shared/components/PageSpinner'

import {getLinksAsync} from 'src/shared/actions/links'

// Actions
import {disablePresentationMode} from 'src/shared/actions/app'
import {errorThrown} from 'src/shared/actions/errors'
import {notify} from 'src/shared/actions/notifications'

import {getMeAsync} from 'src/shared/actions/auth'

import {
  getVSpheresAsync,
  updateVcenterAction,
  updateVcentersAction,
  RequestVcenterAction,
  ResponseVcenterAction,
  RequestPauseVcenterAction,
  getVSphereInfoSaltApiAsync,
  ActionTypes as vmHostActionType,
} from 'src/clouds/actions/vspheres'

import {TimeMachineContextProvider} from 'src/shared/utils/TimeMachineContext'

import {getEnv} from 'src/shared/apis/env'

import 'src/style/cloudhub.scss'

import {HEARTBEAT_INTERVAL} from 'src/shared/constants'

import * as ErrorsModels from 'src/types/errors'
import {setCustomAutoRefreshOptions} from './shared/components/dropdown_auto_refresh/autoRefreshOptions'

import {AddonType} from 'src/shared/constants'
import {Addon} from 'src/types/auth'
import {reducerVSphere, ResponseVSphere} from './clouds/types'
import {getElasticSearchInfoAsync} from 'src/shared/actions/elasticSearch'
import {
  KUBERNETES_NETWORK_ROUTE,
  KUBERNETES_OVERVIEW_ROUTE,
  LEGACY_HUBBLE_ROUTE,
} from 'src/hubble/navigation'
import {
  SERVER_DETAILS_PAGE_NAME,
  SERVER_DETAILS_IMPORT_PATH,
} from './shared/constants/routes'

// Lazy-loaded routes: these pull in heavy libraries (mxgraph, opensearch-oui,
// codemirror, d3) that unrelated routes shouldn't have to fetch on every load.
const TopologyRouter = React.lazy(
  () => import('src/hosts/containers/TopologyRouter')
)
const NewHostsPage = React.lazy(
  () => import('src/hosts/containers/NewHostsPage')
)
const HostPage = React.lazy(
  () => import('src/hosts/containers/HostPage')
)
const LogAnalysisDashboard = React.lazy(
  () => import('src/log_analysis/containers/LogAnalysisDashboard')
)
const DashboardsPage = React.lazy(
  () => import('src/dashboards/containers/DashboardsPage')
)
const DashboardPage = React.lazy(
  () => import('src/dashboards/containers/DashboardPage')
)
const Clouds = React.lazy(() =>
  import('src/clouds').then(m => ({default: m.Clouds}))
)
const AgentAdminPage = React.lazy(() =>
  import('src/agent_admin').then(m => ({default: m.AgentAdminPage}))
)
const KapacitorPage = React.lazy(() =>
  import('src/kapacitor').then(m => ({default: m.KapacitorPage}))
)
const KapacitorRulePage = React.lazy(() =>
  import('src/kapacitor').then(m => ({default: m.KapacitorRulePage}))
)
const KapacitorRulesPage = React.lazy(() =>
  import('src/kapacitor').then(m => ({default: m.KapacitorRulesPage}))
)
const TickscriptPage = React.lazy(() =>
  import('src/kapacitor').then(m => ({default: m.TickscriptPage}))
)

// Experiment: lazy-load every remaining route to measure the ceiling of this approach.
const StatusPage = React.lazy(() =>
  import('src/status').then(m => ({default: m.StatusPage}))
)
const DataExplorerPage = React.lazy(() => import('src/data_explorer'))
const Applications = React.lazy(() =>
  import('src/applications').then(m => ({default: m.Applications}))
)
const AiChatTestPage = React.lazy(() =>
  import('src/reusable_ui/components/cloudhub_ai_chat/AiChatTestPage').then(m => ({default: m.AiChatTestPage}))
)
const LogsPage = React.lazy(() =>
  import('src/logs').then(m => ({default: m.LogsPage}))
)
const ActivityLogsPage = React.lazy(() =>
  import('src/activitylogs').then(m => ({default: m.ActivityLogsPage}))
)
const AlertsApp = React.lazy(() => import('src/alerts'))
const AdminCloudHubPage = React.lazy(() =>
  import('src/admin').then(m => ({default: m.AdminCloudHubPage}))
)
const AdminInfluxDBPage = React.lazy(() =>
  import('src/admin').then(m => ({default: m.AdminInfluxDBPage}))
)
const ManageSources = React.lazy(
  () => import('src/sources/containers/ManageSources')
)
const GraphqlProvider = React.lazy(() =>
  import('src/addon/128t').then(m => ({default: m.GraphqlProvider}))
)
const PredictionRouter = React.lazy(
  () => import('src/device_management/containers/PredictionRouter')
)
const PredictionRulePage = React.lazy(
  () => import('src/device_management/containers/PredictionRulePage')
)
const ManagementRouter = React.lazy(
  () => import('src/device_management/containers/ManagementRouter')
)
const OverviewPage = React.lazy(
  () => import('src/overview/containers/OverviewPage')
)
const ServerDetailsWrapper = React.lazy(
  () => import('src/server_details/containers/ServerDetailsWrapper')
)
const GPUMonitoringPage = React.lazy(
  () => import('src/gpu_monitoring/containers/GPUMonitoringPage')
)
const URLMonitoringPage = React.lazy(
  () => import('src/url_monitoring/containers/URLMonitoringPage')
)
const URLAlertSettingPage = React.lazy(
  () => import('src/url_monitoring/containers/URLAlertSettingPage')
)
const URLAlertPage = React.lazy(
  () => import('src/url_monitoring/containers/URLAlertPage')
)
const DBMonitoringPage = React.lazy(
  () => import('src/db_monitoring/containers/DBMonitoringPage')
)
const AlertGroupRulePage = React.lazy(
  () => import('src/alert_group/containers/AlertGroupRulePage')
)
const AppPerformanceMonitoringPage = React.lazy(
  () => import('src/app_monitoring/containers/AppPerformanceMonitoringPage')
)
const KubernetesRouter = React.lazy(
  () => import('src/clouds/containers/KubernetesRouter')
)
const HubblePage = React.lazy(() => import('src/hubble/containers/HubblePage'))
const OpenStackRouter = React.lazy(
  () => import('src/clouds/containers/OpenStackRouter')
)
const VMHostRouter = React.lazy(
  () => import('./clouds/containers/VMHostRouter')
)
const NutanixPage = React.lazy(() => import('./nutanix/containers/NutanixPage'))
const MainOverviewPage = React.lazy(() => import('src/main/OverviewPage'))
const GroupDetailPage = React.lazy(
  () => import('src/admin/containers/cloudhub/GroupDetailPage')
)
const ServerAlertManagementPage = React.lazy(
  () => import('src/server_alert/containers/ServerAlertManagementPage')
)

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

const persistedLanguage = store.getState().app?.persisted?.language
if (persistedLanguage === 'en' || persistedLanguage === 'ko') {
  i18n.changeLanguage(persistedLanguage)
}

// pathname of last location change
let lastPathname: Pathname

browserHistory.listen(location => {
  // disable presentation mode only if pathname changes, #5382
  if (lastPathname !== location.pathname) {
    dispatch(disablePresentationMode())
    lastPathname = location.pathname
  }
})

window.addEventListener('keyup', event => {
  const escapeKeyCode = 27
  // fallback for browsers that don't support event.key
  if (event.key === 'Escape' || event.keyCode === escapeKeyCode) {
    dispatch(disablePresentationMode())
  }
})

const history = syncHistoryWithStore(browserHistory, store)

const populateEnv = async url => {
  try {
    const envVars = await getEnv(url)
    setCustomAutoRefreshOptions(envVars.customAutoRefresh)
  } catch (error) {
    console.error('Error fetching envVars', error)
  }
}

interface State {
  ready: boolean
}

class Root extends PureComponent<Record<string, never>, State> {
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

  private handleRequestVcenter = bindActionCreators(
    RequestVcenterAction,
    dispatch
  )

  private handleResponseVcenter = bindActionCreators(
    ResponseVcenterAction,
    dispatch
  )

  private handleRequestPauseVcenter = bindActionCreators(
    RequestPauseVcenterAction,
    dispatch
  )

  private handleGetElasticSearchInfo = bindActionCreators(
    getElasticSearchInfoAsync,
    dispatch
  )

  private heartbeatTimer: number

  private timeout: {
    [name: string]: {
      id: string
      host: string
      isPause: boolean
      timer: number
      timeout: number
    }
  } = {}

  constructor(props) {
    super(props)
    this.state = {
      ready: false,
    }
  }

  public async UNSAFE_componentWillMount() {
    this.flushErrorsQueue()

    try {
      await this.getLinks()
      await this.checkAuth()
      await populateEnv(store.getState().links.environment)
      await this.getEsSources()
      this.setState({ready: true})
    } catch (error) {
      dispatch(errorThrown(error))
    }
  }

  public componentWillUnmount() {
    this.unsubscribe()
    clearTimeout(this.heartbeatTimer)
    this.handleClearAllTimeout()
  }

  public render() {
    return this.state.ready ? (
      <ReduxProvider store={store}>
        <TimeMachineContextProvider>
          <Suspense fallback={<PageSpinner />}>
            <Router history={history}>
              <Route path="/" component={UserIsAuthenticated(CheckSources)} />
              <Route path="/login" component={UserIsNotAuthenticated(Login)} />
              <Route
                path="/password-reset"
                component={UserIsNotAuthenticated(PasswordReset)}
              />
              <Route
                path="/otp-login"
                component={UserIsNotAuthenticated(OTPLoginPage)}
              />
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
                  {/* network monitoring */}
                  <Route
                    path="network-monitoring/anomaly-prediction"
                    component={PredictionRouter}
                  />
                  <Route
                    path="network-monitoring/:tab/prediction-rule"
                    component={PredictionRulePage}
                  />
                  <Route
                    path="network-monitoring/management"
                    component={ManagementRouter}
                  />
                  {/* server monitoring */}
                  <Route
                    path="server-monitoring/topology"
                    component={props => (
                      <TopologyRouter
                        {...props}
                        handleClearTimeout={this.handleClearTimeout}
                      />
                    )}
                  />
                  <Route
                    path="server-monitoring/overview"
                    component={OverviewPage}
                  />
                  <Route
                    path="server-monitoring/server-list"
                    // component={HostPageRouter}
                    component={NewHostsPage}
                  />
                  <Route
                    path="server-monitoring/server-list/:hostID"
                    component={HostPage}
                  />
                  <Route
                    path={`server-monitoring/${SERVER_DETAILS_PAGE_NAME}`}
                    component={ServerDetailsWrapper}
                  />
                  <Route
                    path={`server-monitoring/${SERVER_DETAILS_IMPORT_PATH}`}
                    component={ServerDetailsWrapper}
                  />
                  <Route
                    path="server-monitoring/gpu-monitoring"
                    component={GPUMonitoringPage}
                  />
                  <Route
                    path="server-monitoring/server-alert"
                    component={ServerAlertManagementPage}
                  />
                  <Route
                    path="server-monitoring/alert-setup"
                    component={AlertGroupRulePage}
                  />
                  {/* url monitoring */}
                  <Route
                    path="url-monitoring/url-alert-setting"
                    component={URLAlertSettingPage}
                  />
                  <Route path="url-monitoring" component={URLMonitoringPage} />
                  <Route
                    path="url-monitoring/url-list"
                    component={URLMonitoringPage}
                  />
                  <Route
                    path="url-monitoring/url-alert"
                    component={URLAlertPage}
                  />
                  {/* db monitoring */}
                  <Route path="db-monitoring" component={DBMonitoringPage} />

                  {/* app performance monitoring */}
                  <Route
                    path="app-performance-monitoring"
                    component={AppPerformanceMonitoringPage}
                  />

                  {/* kubernetes */}
                  <Route
                    path={KUBERNETES_NETWORK_ROUTE}
                    component={HubblePage}
                  />
                  <Route
                    path={KUBERNETES_OVERVIEW_ROUTE}
                    component={KubernetesRouter}
                  />
                  <Redirect
                    from={LEGACY_HUBBLE_ROUTE}
                    to={KUBERNETES_NETWORK_ROUTE}
                  />

                  {/* openstack */}
                  <Route path="openstack" component={OpenStackRouter} />

                  {/* vmware */}
                  <Route path="vmware" component={VMHostRouter} />

                  {/* nutanix */}
                  <Route path="nutanix" component={NutanixPage} />

                  {/* <Route
                  path="ai/:tab"
                  component={props => (
                    <AiRoutePage
                      {...props}
                      handleClearTimeout={this.handleClearTimeout}
                    />
                  )}
                />
                <Route
                  path="ai/:tab/prediction-rule"
                  component={PredictionRulePage}
                /> */}

                  <Route path="overview" component={MainOverviewPage} />
                  <Route path="status" component={StatusPage} />
                  <Route path="visualize" component={DataExplorerPage} />
                  <Route path="dashboards" component={DashboardsPage} />
                  <Route
                    path="dashboards/:dashboardID"
                    component={DashboardPage}
                  />
                  {/* <Route
                  path="infrastructure/:infraTab"
                  component={props => (
                    <Infrastructure
                      {...props}
                      handleClearTimeout={this.handleClearTimeout}
                    />
                  )}
                /> */}
                  {/* <Route
                  path="infrastructure/details/:hostID"
                  component={HostPage}
                /> */}
                  <Route
                    path="clouds/:cloud"
                    component={props => (
                      <Clouds
                        {...props}
                        handleClearTimeout={this.handleClearTimeout}
                      />
                    )}
                  />
                  <Route path="applications" component={Applications} />
                  <Route path="ai-chat-test" component={AiChatTestPage} />
                  <Route path="alerts" component={AlertsApp} />
                  <Route path="alert-rules" component={KapacitorRulesPage} />
                  <Route
                    path="kapacitors/:kid/alert-rules/:ruleID" // ruleID can be "new"
                    component={KapacitorRulePage}
                  />
                  <Route
                    path="alert-rules/:ruleID"
                    component={KapacitorRulePage}
                  />
                  <Route
                    path="alert-group-rules/new"
                    component={AlertGroupRulePage}
                  />
                  <Route
                    path="alert-group-rules/:id/edit"
                    component={AlertGroupRulePage}
                  />
                  <Route path="log-analysis" component={LogAnalysisDashboard} />
                  <Route path="activity-logs" component={ActivityLogsPage} />
                  <Route path="logs" component={LogsPage} />
                  <Route
                    path="kapacitors/:kid/tickscripts/:ruleID" // ruleID can be "new"
                    component={TickscriptPage}
                  />
                  <Route path="kapacitors/new" component={KapacitorPage} />
                  <Route path="kapacitors/:id/edit" component={KapacitorPage} />
                  <Route
                    path="kapacitors/:id/edit:hash"
                    component={KapacitorPage}
                  />
                  <Route
                    path="group-management/detail(/:groupId)"
                    component={GroupDetailPage}
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
                    component={props => {
                      return (
                        <GraphqlProvider
                          {...props}
                          page={'SwanSdplexSettingPage'}
                        />
                      )
                    }}
                  />
                  <Route path="account-change" component={UpdateUser} />
                </Route>
              </Route>
              <Route path="*" component={NotFound} />
            </Router>
          </Suspense>
        </TimeMachineContextProvider>
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

  private isUsingVshpere = () => {
    const {
      links: {addons},
    } = store.getState()

    const isUsingVshpere = _.find(addons, addon => {
      return addon.name === 'vsphere' && addon.url === 'on'
    })

    return isUsingVshpere
  }

  private promiseGenerator = (
    salt: {url: string; token: string},
    vsphere: reducerVSphere['vspheres']['host']
  ) => {
    const {url, token} = salt
    const {minion, host, username, password, port, protocol} = vsphere

    return this.handleGetVSphereInfoSaltApi(
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

  private unsubscribe = store.subscribe(async () => {
    const {lastAction} = store.getState()

    if (lastAction.type === vmHostActionType.RequestPauseVcenter) {
      const {host} = lastAction.payload
      this.handleClearTimeout(host)
    }

    if (lastAction.type === vmHostActionType.RequestRunVcenter) {
      const {host, id} = lastAction.payload
      this.checkTimeout(id, host)
    }

    if (
      lastAction.type === 'LOAD_SOURCES' ||
      lastAction.type === 'CONNECTED_SOURCE'
    ) {
      this.handleClearAllTimeout()
      const isUsingVshpere = this.isUsingVshpere()

      if (isUsingVshpere) {
        await this.checkVSpheres()
      }
    }

    if (lastAction.type === vmHostActionType.LoadVcenters) {
      const vSpheres = lastAction.payload

      if (vSpheres && _.keys(vSpheres).length < 0) return

      const salt = this.getSaltAddon()

      const promises = _.map(_.keys(vSpheres), (key: string) => {
        return this.promiseGenerator(salt, vSpheres[key])
      })

      try {
        this.handleRequestVcenter()
        Promise.allSettled(promises)
          .then(data => {
            const succesData = _.filter(
              data,
              d =>
                d.status === 'fulfilled' &&
                d?.value &&
                _.keys(d.value['return'][0]).length
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
                isPause: false,
              }
            })

            this.handleUpdateVcenters(updateVcenters)
          })
          .catch(err => {
            throw err
          })
          .finally(() => {
            this.handleResponseVcenter()
          })
      } catch (error) {
        console.error(error)
        dispatch(errorThrown(error))
      }
    }

    if (lastAction.type === vmHostActionType.AddVcenter) {
      const {id, host} = lastAction.payload
      this.checkTimeout(id, host)
    }

    if (lastAction.type === vmHostActionType.UpdateVcenters) {
      this.checkTimeout()
    }

    if (lastAction.type === vmHostActionType.UpdateVcenter) {
      const {id, host} = lastAction.payload
      this.checkTimeout(id, host)
    }
  })

  private checkTimeout = (id?: string, host?: string) => {
    const {
      vspheres: {vspheres},
    }: {vspheres: reducerVSphere} = store.getState()
    const vSpheresKeys = _.keys(vspheres)
    const salt = this.getSaltAddon()

    if (host && parseInt(id) > -1) {
      vSpheresKeys.forEach(async key => {
        if (this.timeout[key]) {
          if (this.timeout[key].id === id) {
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
          await this.requestVSphere(key, salt, vSphere, false, 'ADD')
        }
      })
    }
  }

  private handleClearTimeout = (key: string) => {
    _.forEach(_.keys(this.timeout), k => {
      if (this.timeout[k].host === key) {
        window.clearTimeout(this.timeout[k].timeout)
        delete this.timeout[k]
      }
    })
  }

  private handleClearAllTimeout = () => {
    const timeoutKeys = _.keys(this.timeout)
    if (timeoutKeys.length > 0) return
    _.forEach(timeoutKeys, key => {
      clearInterval(this.timeout[key].timeout)
    })
  }

  private async requestVSphere(
    key: string,
    salt: {url: string; token: string},
    vsphere: reducerVSphere['vspheres']['host'],
    isOnetime: boolean = false,
    type: string = ''
  ) {
    if (isOnetime) return

    const {interval, id, isPause} = vsphere
    this.handleClearTimeout(key)

    this.timeout[key] = {
      id,
      host: key,
      timer: interval,
      isPause,
      timeout: isPause
        ? null
        : window.setTimeout(async () => {
            if (store.getState().vspheres.vspheres[key]) {
              const {url, token} = salt
              const {
                minion,
                host,
                id,
                username,
                password,
                port,
                protocol,
              } = vsphere
              let getVsphere: ResponseVSphere
              try {
                getVsphere = (await this.handleGetVSphereInfoSaltApi(
                  url,
                  token,
                  minion,
                  host,
                  username,
                  password,
                  port,
                  protocol
                )) as any

                const {
                  vspheres: {vspheres},
                } = store.getState()

                if (getVsphere && !vspheres[host].isPause) {
                  this.handleUpdateVcenter({...vsphere, nodes: getVsphere})
                  if (type === 'ADD') {
                    this.requestVSphere(key, salt, vsphere, true)
                  }
                } else {
                  this.handleRequestPauseVcenter(host, id)
                }
              } catch (error) {
                console.error(error)
              }
            }
          }, interval),
    }
  }

  private checkVSpheres = async () => {
    const {
      source: {sourceID},
    } = store.getState()

    if (_.isEmpty(sourceID)) return

    try {
      await this.getVSpheres({shouldResetVSphere: true, sourceID})
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

  private getEsSources = async () => {
    await this.handleGetElasticSearchInfo()
  }
}

if (rootNode) {
  render(<Root />, rootNode)
}
