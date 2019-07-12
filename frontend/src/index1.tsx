import React, {PureComponent} from 'react'
import {render} from 'react-dom'
import {Provider as ReduxProvider} from 'react-redux'
import {bindActionCreators} from 'redux'
import {Router, Route, useRouterHistory} from 'react-router'
import {Provider as UnstatedProvider} from 'unstated'
import {createHistory} from 'history'
import {syncHistoryWithStore} from 'react-router-redux'

import configureStore from 'src/store/configureStore'
import {loadLocalStorage} from 'src/localStorage'
import {getRootNode} from 'src/utils/nodes'
import {getBasepath} from 'src/utils/basepath'
import {disablePresentationMode} from 'src/shared/actions/app'
import App from 'src/App'
import {LogsPage} from 'src/logs'
import {
  Login,
  UserIsAuthenticated,
  UserIsNotAuthenticated,
  Purgatory,
} from 'src/auth'
import NotFound from 'src/shared/components/NotFound'
import PageSpinner from 'src/shared/components/PageSpinner'
import {notify} from 'src/shared/actions/notifications'
import {errorThrown} from 'src/shared/actions/errors'
import {getLinksAsync} from 'src/shared/actions/links'
import {getMeAsync} from 'src/shared/actions/auth'
import * as ErrorsModels from 'src/types/errors'
import {HEARTBEAT_INTERVAL} from 'src/shared/constants/index'
import CheckSources from 'src/CheckSources'
import {ManageSources, OnboardingWizard} from 'src/sources'

import 'src/style/cmp.scss'

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

const history = syncHistoryWithStore(browserHistory, store)

interface State {
  ready: boolean
}

class Root extends PureComponent<{}, State> {
  private getLinks = bindActionCreators(getLinksAsync, dispatch)
  private getMe = bindActionCreators(getMeAsync, dispatch)
  private heartbeatTimer: number

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
      this.setState({ready: true})
    } catch (error) {
      dispatch(errorThrown(error))
    }
  }

  public componentWillUnmount() {
    clearTimeout(this.heartbeatTimer)
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
            <Route component={UserIsAuthenticated(App)}>
              <Route path="/logs" component={LogsPage} />
            </Route>
            <Route
              path="/sources/new"
              component={UserIsAuthenticated(OnboardingWizard)}
            />
            <Route
              path="/sources/:sourceID"
              component={UserIsAuthenticated(App)}
            >
              <Route component={CheckSources}>
                <Route path="manage-sources" component={ManageSources} />
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
  private async performHeartbeat({shouldResetMe = false} = {}) {
    await this.getMe({shouldResetMe})

    this.heartbeatTimer = window.setTimeout(() => {
      if (store.getState().auth.me !== null) {
        this.performHeartbeat()
      }
    }, HEARTBEAT_INTERVAL)
  }
}

if (rootNode) {
  render(<Root />, rootNode)
}
