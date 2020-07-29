import {DEFAULT_TIME_RANGE} from 'src/shared/data/timeRanges'
import {State as DashTimeState} from 'src/dashboards/reducers/dashTimeV1'

export const getTimeRange = (
  state: {dashTimeV1: DashTimeState},
  dashboardID: string
) =>
  state.dashTimeV1.ranges.find(r => r.dashboardID === dashboardID) ||
  DEFAULT_TIME_RANGE
