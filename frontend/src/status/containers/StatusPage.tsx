// Libraries
import React, {Component} from 'react'
import ReactGridLayout, {WidthProvider} from 'react-grid-layout'
import {connect} from 'react-redux'
import moment from 'moment'

// Components
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import Layout from 'src/shared/components/Layout'
import {Page} from 'src/reusable_ui'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import {ChartJSAlertBarChart} from 'src/shared/components/ChartJSAlertBarChart'

// Actions
import * as appActions from 'src/shared/actions/app'
import {
  resetStatusDashboard,
  setStatusSelectedAnomaly,
  setStatusHistogramDate,
  setStatusAlertHostList,
} from 'src/status/actions'

// Reducers
import {initialState} from 'src/status/reducers/statusDashboard'

// Constants
import {STATUS_PAGE_TIME_RANGE} from 'src/shared/data/timeRanges'
import {fixtureStatusPageCells} from 'src/status/fixtures'
import {
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
  STATUS_PAGE_ROW_COUNT,
  PAGE_HEADER_HEIGHT,
  PAGE_CONTAINER_MARGIN,
  LAYOUT_MARGIN,
} from 'src/shared/constants'

// Types
import {
  Cell,
  Source,
  Template,
  TemplateType,
  TemplateValueType,
  TimeRange,
  TimeZones,
} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {bindActionCreators} from 'redux'
interface OwnProps {
  source: Source
  shellModalVisible: boolean
}

interface StateProps {
  timeZone: TimeZones
  statusHistogramDate: TimeRange | null
  onSetTimeZone: typeof appActions.setTimeZone
  onResetStatusDashboard: typeof resetStatusDashboard
  setStatusSelectedAnomaly: typeof setStatusSelectedAnomaly
  setStatusHistogramDate: typeof setStatusHistogramDate
  setStatusAlertHostList: typeof setStatusAlertHostList
}

const timeRange = STATUS_PAGE_TIME_RANGE

type Props = StateProps & OwnProps

@ErrorHandling
class StatusPage extends Component<Props> {
  private GridLayout = WidthProvider(ReactGridLayout)

  constructor(props: Props) {
    super(props)

    this.state = {
      shellModalVisible: false,
    }
  }

  componentDidMount() {
    this.props.onResetStatusDashboard()
  }

  //Todo: connect elasticsearch

  private handleDateClick = (timeRange: TimeRange) => {
    const {
      setStatusSelectedAnomaly,
      setStatusAlertHostList,
      setStatusHistogramDate,
    } = this.props

    setStatusSelectedAnomaly(initialState.selectedAnomaly)
    setStatusAlertHostList(initialState.alertHostList)
    setStatusHistogramDate(timeRange)
  }

  private handleDateRangeSelect = (timeRange: TimeRange) => {
    const {
      setStatusSelectedAnomaly,
      setStatusAlertHostList,
      setStatusHistogramDate,
    } = this.props

    setStatusSelectedAnomaly(initialState.selectedAnomaly)
    setStatusAlertHostList(initialState.alertHostList)
    setStatusHistogramDate(timeRange)
  }

  private handleDateClear = () => {
    const {
      setStatusSelectedAnomaly,
      setStatusAlertHostList,
      setStatusHistogramDate,
    } = this.props

    setStatusSelectedAnomaly(initialState.selectedAnomaly)
    setStatusAlertHostList(initialState.alertHostList)
    setStatusHistogramDate(null)
  }

  public render() {
    const {source, onSetTimeZone, timeZone} = this.props
    const cells = fixtureStatusPageCells(source)
    const rowHeight = this.calculateRowHeight()
    const GridLayout = this.GridLayout

    return (
      <Page>
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="Status" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true}>
            <TimeZoneToggle onSetTimeZone={onSetTimeZone} timeZone={timeZone} />
          </Page.Header.Right>
        </Page.Header>
        <Page.Contents fullWidth={true}>
          <div className="dashboard container-fluid full-width">
            {cells.length ? (
              <>
                <Authorized
                  requiredRole={EDITOR_ROLE}
                  propsOverride={{
                    isDraggable: false,
                    isResizable: false,
                    draggableHandle: null,
                  }}
                >
                  <GridLayout
                    layout={this.reBuildCell(cells)}
                    cols={96}
                    rowHeight={rowHeight}
                    margin={[LAYOUT_MARGIN, LAYOUT_MARGIN]}
                    containerPadding={[0, 0]}
                    useCSSTransforms={false}
                    draggableHandle={'.dash-graph--draggable'}
                    isDraggable={false}
                    isResizable={false}
                  >
                    {this.reBuildCell(cells).map(cell => (
                      <div key={cell.i}>
                        {cell.i === 'alerts-bar-graph' ? (
                          <div className="dash-graph">
                            <div className="dash-graph--heading">
                              <span className="dash-graph--name">
                                Alert Events per Day – Last 30 Days
                              </span>
                            </div>
                            <div className="dash-graph--container">
                              <ChartJSAlertBarChart
                                cell={cell}
                                source={source}
                                timeZone={timeZone}
                                onDateClick={this.handleDateClick}
                                onDateRangeSelect={this.handleDateRangeSelect}
                                onDateClear={this.handleDateClear}
                              />
                            </div>
                          </div>
                        ) : (
                          <Authorized
                            requiredRole={EDITOR_ROLE}
                            propsOverride={{
                              isEditable: false,
                            }}
                          >
                            <Layout
                              key={cell.i}
                              cell={cell}
                              host={''}
                              source={source}
                              onZoom={() => {}}
                              sources={[]}
                              templates={this.templates}
                              timeRange={timeRange}
                              isEditable={false}
                              onDeleteCell={() => {}}
                              onCloneCell={() => {}}
                              onShowInformation={() => {}}
                              manualRefresh={0}
                              onSummonOverlayTechnologies={() => {}}
                            />
                          </Authorized>
                        )}
                      </div>
                    ))}
                  </GridLayout>
                </Authorized>
              </>
            ) : (
              <span>Loading Status Page...</span>
            )}
          </div>
        </Page.Contents>
      </Page>
    )
  }

  private getDateRangeText = (histogramDate: TimeRange | null): string => {
    if (!histogramDate?.lower) {
      return 'Last 30 Days'
    }

    const startDate = moment(histogramDate.lower).format('YYYY-MM-DD')

    if (histogramDate.upper) {
      const endDate = moment(histogramDate.upper)
        .subtract(1, 'day')
        .format('YYYY-MM-DD')

      if (startDate === endDate) {
        return startDate
      }

      return `${startDate} ~ ${endDate}`
    } else {
      return startDate
    }
  }

  private reBuildCell(cells: Cell[]) {
    const {timeZone, statusHistogramDate} = this.props

    return cells.map(cell => {
      if (cell.i === 'alerts-bar-graph') {
        return {
          ...cell,
          queries: cell.queries.map(i => {
            return {
              ...i,
              groupbys: ['time(1d)'],
              wheres: [],
              tz:
                timeZone === TimeZones.UTC
                  ? 'UTC'
                  : `${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
            }
          }),
        }
      } else if (cell.i === 'recent-alerts') {
        const dateRangeText = this.getDateRangeText(statusHistogramDate)
        return {
          ...cell,
          name: `Alerts – ${dateRangeText}`,
        }
      } else {
        return cell
      }
    })
  }

  private get templates(): Template[] {
    const dashboardTime = {
      id: 'dashtime',
      tempVar: TEMP_VAR_DASHBOARD_TIME,
      type: TemplateType.Constant,
      label: '',
      values: [
        {
          value: timeRange.lower,
          type: TemplateValueType.Constant,
          selected: true,
          localSelected: true,
        },
      ],
    }

    const upperDashboardTime = {
      id: 'upperdashtime',
      tempVar: TEMP_VAR_UPPER_DASHBOARD_TIME,
      type: TemplateType.Constant,
      label: '',
      values: [
        {
          value: 'now()',
          type: TemplateValueType.Constant,
          selected: true,
          localSelected: true,
        },
      ],
    }

    return [dashboardTime, upperDashboardTime]
  }

  private calculateRowHeight() {
    return (
      (window.innerHeight -
        STATUS_PAGE_ROW_COUNT * LAYOUT_MARGIN -
        PAGE_HEADER_HEIGHT -
        PAGE_CONTAINER_MARGIN -
        PAGE_CONTAINER_MARGIN) /
      STATUS_PAGE_ROW_COUNT
    )
  }
}

const mstp = ({app, statusDashboard}) => ({
  timeZone: app.persisted.timeZone,
  statusHistogramDate: statusDashboard?.histogramDate || null,
})

const mdtp = dispatch => ({
  onSetTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),
  onResetStatusDashboard: bindActionCreators(resetStatusDashboard, dispatch),
  setStatusSelectedAnomaly: bindActionCreators(
    setStatusSelectedAnomaly,
    dispatch
  ),
  setStatusHistogramDate: bindActionCreators(setStatusHistogramDate, dispatch),
  setStatusAlertHostList: bindActionCreators(setStatusAlertHostList, dispatch),
})

export default connect(mstp, mdtp)(StatusPage)
