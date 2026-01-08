// he is a library for safely encoding and decoding HTML Entities
import he from 'he'
import {Dispatch} from 'redux'

import {fetchJSONFeed as fetchJSONFeedAJAX} from 'src/status/apis'

import {AlertHostList, AnomalyFactor, JSONFeedData, TimeRange} from 'src/types'

export enum ActionTypes {
  FETCH_JSON_FEED_REQUESTED = 'FETCH_JSON_FEED_REQUESTED',
  FETCH_JSON_FEED_COMPLETED = 'FETCH_JSON_FEED_COMPLETED',
  FETCH_JSON_FEED_FAILED = 'FETCH_JSON_FEED_FAILED',
  // Status Dashboard Actions
  SET_STATUS_HISTOGRAM_DATE = 'SET_STATUS_HISTOGRAM_DATE',
  SET_STATUS_SELECTED_ANOMALY = 'SET_STATUS_SELECTED_ANOMALY',
  SET_STATUS_ALERT_HOST_LIST = 'SET_STATUS_ALERT_HOST_LIST',
  RESET_STATUS_DASHBOARD = 'RESET_STATUS_DASHBOARD',
}

interface FetchJSONFeedRequestedAction {
  type: ActionTypes.FETCH_JSON_FEED_REQUESTED
}

interface FetchJSONFeedCompletedAction {
  type: ActionTypes.FETCH_JSON_FEED_COMPLETED
  payload: {data: JSONFeedData}
}

interface FetchJSONFeedFailedAction {
  type: ActionTypes.FETCH_JSON_FEED_FAILED
}

// Status Dashboard Actions
interface StatusHistogramDateAction {
  type: ActionTypes.SET_STATUS_HISTOGRAM_DATE
  payload: {
    histogramDate: TimeRange
  }
}

interface StatusSelectedAnomalyAction {
  type: ActionTypes.SET_STATUS_SELECTED_ANOMALY
  payload: {
    selectedAnomaly: AnomalyFactor
  }
}

interface StatusAlertHostListAction {
  type: ActionTypes.SET_STATUS_ALERT_HOST_LIST
  payload: {
    alertHostList: AlertHostList
  }
}

interface ResetStatusDashboardAction {
  type: ActionTypes.RESET_STATUS_DASHBOARD
}

export type Action =
  | FetchJSONFeedRequestedAction
  | FetchJSONFeedCompletedAction
  | FetchJSONFeedFailedAction
  | StatusHistogramDateAction
  | StatusSelectedAnomalyAction
  | StatusAlertHostListAction
  | ResetStatusDashboardAction

const fetchJSONFeedRequested = (): FetchJSONFeedRequestedAction => ({
  type: ActionTypes.FETCH_JSON_FEED_REQUESTED,
})

const fetchJSONFeedCompleted = (
  data: JSONFeedData
): FetchJSONFeedCompletedAction => ({
  type: ActionTypes.FETCH_JSON_FEED_COMPLETED,
  payload: {data},
})

const fetchJSONFeedFailed = (): FetchJSONFeedFailedAction => ({
  type: ActionTypes.FETCH_JSON_FEED_FAILED,
})

export const fetchJSONFeedAsync = (url: string) => async (
  dispatch: Dispatch<Action>
): Promise<void> => {
  dispatch(fetchJSONFeedRequested())
  try {
    const data = (await fetchJSONFeedAJAX(url)) as JSONFeedData
    // data could be from a webpage, and thus would be HTML
    if (typeof data === 'string' || !data) {
      dispatch(fetchJSONFeedFailed())
    } else {
      // decode HTML entities from response text
      const decodedData = {
        ...data,
        items: data.items.map(item => {
          item.title = he.decode(item.title)
          item.content_text = he.decode(item.content_text)
          return item
        }),
      }
      dispatch(fetchJSONFeedCompleted(decodedData))
    }
  } catch (error) {
    console.error(error)
    dispatch(fetchJSONFeedFailed())
  }
}

// Status Dashboard Action Creators
export const setStatusHistogramDate = (
  histogramDate: TimeRange
): StatusHistogramDateAction => ({
  type: ActionTypes.SET_STATUS_HISTOGRAM_DATE,
  payload: {
    histogramDate,
  },
})

export const setStatusSelectedAnomaly = (
  selectedAnomaly: AnomalyFactor
): StatusSelectedAnomalyAction => ({
  type: ActionTypes.SET_STATUS_SELECTED_ANOMALY,
  payload: {
    selectedAnomaly,
  },
})

export const setStatusAlertHostList = (
  alertHostList: AlertHostList
): StatusAlertHostListAction => ({
  type: ActionTypes.SET_STATUS_ALERT_HOST_LIST,
  payload: {
    alertHostList,
  },
})

export const resetStatusDashboard = (): ResetStatusDashboardAction => ({
  type: ActionTypes.RESET_STATUS_DASHBOARD,
})
