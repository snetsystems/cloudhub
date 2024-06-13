import {createStore, applyMiddleware, compose} from 'redux'
import {combineReducers} from 'redux'
import {routerReducer, routerMiddleware} from 'react-router-redux'
import thunkMiddleware from 'redux-thunk'

import errorsMiddleware from 'src/shared/middleware/errors'
import {resizeLayout} from 'src/shared/middleware/resizeLayout'
import {queryStringConfig} from 'src/shared/middleware/queryStringConfig'
import statusReducers from 'src/status/reducers'
import logsReducer from 'src/logs/reducers'
import activitylogsReducer from 'src/activitylogs/reducers'
import sharedReducers from 'src/shared/reducers'
import dataExplorerReducers from 'src/data_explorer/reducers'
import adminReducers from 'src/admin/reducers'
import kapacitorReducers from 'src/kapacitor/reducers'
import dashboardUI from 'src/dashboards/reducers/ui'
import cellEditorOverlay from 'src/dashboards/reducers/cellEditorOverlay'
import dashTimeV1 from 'src/dashboards/reducers/dashTimeV1'
import persistStateEnhancer from './persistStateEnhancer'
import servicesReducer from 'src/shared/reducers/services'
import envReducer from 'src/shared/reducers/env'
import {vspheres} from 'src/clouds/reducers'
import source from 'src/sources/reducers'
import aiModal from 'src/shared/reducers/aiModal'

// eslint-disable-next-line no-unused-vars
function lastAction(state = {}, action) {
  return action
}

const rootReducer = combineReducers({
  ...statusReducers,
  ...sharedReducers,
  ...dataExplorerReducers,
  ...kapacitorReducers,
  ...adminReducers,
  dashboardUI,
  cellEditorOverlay,
  dashTimeV1,
  envReducer,
  logs: logsReducer,
  activitylogs: activitylogsReducer,
  routing: routerReducer,
  services: servicesReducer,
  vspheres,
  lastAction,
  source,
  aiModal,
})

const composeEnhancers =
  process.env.NODE_ENV === 'production'
    ? compose
    : window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

if (process.env.NODE_ENV === 'production') {
  if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object') {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = function () {}
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = function () {}
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberUnmount = function () {}
  }
}

export default function configureStore(initialState, browserHistory) {
  const routingMiddleware = routerMiddleware(browserHistory)
  const createPersistentStore = composeEnhancers(
    persistStateEnhancer(),
    applyMiddleware(
      thunkMiddleware,
      routingMiddleware,
      errorsMiddleware,
      queryStringConfig,
      resizeLayout
    )
  )(createStore)

  // https://github.com/elgerlambert/redux-localstorage/issues/42
  // createPersistantStore should ONLY take reducer and initialState
  // any store enhancers must be added to the compose() function.
  return createPersistentStore(rootReducer, initialState)
}
