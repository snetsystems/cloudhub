// library
import _ from 'lodash'
import React from 'react'
import {Component} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import ReactObserver from 'react-resize-observer'

// constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
  GRAPH_BG_COLOR,
} from 'src/dashboards/constants'
import {getCells} from 'src/hosts/utils/getCells'

// actions
import {setAutoRefresh} from 'src/shared/actions/app'

// components
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {ErrorHandling} from 'src/shared/decorators/errors'
import OpenStackPageHeader from 'src/clouds/components/OpenStackPageHeader'

// types
import {timeRanges} from 'src/shared/data/timeRanges'
import {Layout, RefreshRate, Source, TimeRange} from 'src/types'
import {FocusedInstance, OpenStackInstance} from 'src/clouds/types/openstack'

// utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

interface Props {
  filteredLayouts: Layout[]
  source: Source
  instance: OpenStackInstance
  focusedInstance: Partial<FocusedInstance>
  selfAutoRefrsh?: number
  autoRefresh?: number
  manualRefresh: number
  timeRange?: TimeRange
  onChooseAutoRefresh?: (milliseconds: RefreshRate) => void
}
interface State {
  selfTimeRange: TimeRange
  selfManulRefresh: number
}
@ErrorHandling
class OpenStackInstanceGraph extends Component<Props, State> {
  public intervalID: number
  constructor(props: Props) {
    super(props)
    const {timeRange} = this.props

    this.state = {
      selfTimeRange: timeRange
        ? timeRange
        : timeRanges.find(tr => tr.lower === 'now() - 1h'),
      selfManulRefresh: 0,
    }
  }
  componentDidMount(): void {
    const {selfAutoRefrsh, autoRefresh} = this.props

    GlobalAutoRefresher.poll(selfAutoRefrsh)
    GlobalAutoRefresher.poll(autoRefresh)
  }
  componentDidUpdate(prevProps: Readonly<Props>): void {
    const {
      manualRefresh: prevManulRefresh,
      selfAutoRefrsh: prevSelfAutorefresh,
      timeRange: prevTimeRange,
      autoRefresh: prevAutoRefresh,
    } = prevProps
    const {manualRefresh, selfAutoRefrsh, autoRefresh, timeRange} = this.props
    if (prevManulRefresh !== manualRefresh) {
      this.setState({selfManulRefresh: manualRefresh})
    }
    if (prevAutoRefresh !== autoRefresh) {
      GlobalAutoRefresher.poll(autoRefresh)
    }
    if (prevSelfAutorefresh !== selfAutoRefrsh) {
      GlobalAutoRefresher.poll(selfAutoRefrsh)
    }
    if (prevTimeRange !== timeRange) {
      this.setState({selfTimeRange: timeRange})
    }
  }

  public async UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const {filteredLayouts, selfAutoRefrsh, autoRefresh} = this.props
    if (filteredLayouts.length) {
      if (selfAutoRefrsh !== nextProps.selfAutoRefrsh) {
        GlobalAutoRefresher.poll(nextProps.selfAutoRefrsh)
      }
      if (autoRefresh !== nextProps.autoRefresh) {
        GlobalAutoRefresher.poll(nextProps.autoRefresh)
      }
    }
  }

  public componentWillUnmount() {
    GlobalAutoRefresher.stopPolling()
  }

  render() {
    const {
      filteredLayouts,
      source,
      instance,
      focusedInstance,
      selfAutoRefrsh,
    } = this.props
    const {selfTimeRange, selfManulRefresh} = this.state
    const layoutCells = getCells(filteredLayouts, source)
    const tempVars = generateForHosts(source)
    const renderInstance = {
      instancename: instance?.instanceName,
      instanceid: instance?.instanceId,
      namespace: instance?.projectName,
    }
    const debouncedFit = _.debounce(() => {
      WindowResizeEventTrigger()
    }, 150)
    const handleOnResize = (): void => {
      debouncedFit()
    }

    return (
      <div className="panel" style={{backgroundColor: DEFAULT_CELL_BG_COLOR}}>
        <OpenStackPageHeader
          cellName={`Monitoring (${focusedInstance.instanceName || ''})`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div className="page-header--right" style={{zIndex: 3}}>
            <AutoRefreshDropdown
              onChoose={this.handleChooseAutoRefresh}
              selected={selfAutoRefrsh}
              onManualRefresh={this.handleManualRefresh}
            />
            <TimeRangeDropdown
              //@ts-ignore
              onChooseTimeRange={this.handleChooseTimeRange}
              selected={selfTimeRange}
            />
          </div>
        </OpenStackPageHeader>
        {_.isEmpty(instance) ? (
          <div className="panel-body">
            <div className="generic-empty-state">
              <h4 style={{margin: '90px 0'}}>No Instances found</h4>
            </div>
          </div>
        ) : (
          <>
            <div
              className="panel-body"
              style={{backgroundColor: GRAPH_BG_COLOR}}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                <ReactObserver onResize={handleOnResize} />
                <LayoutRenderer
                  source={source}
                  sources={[source]}
                  isStatusPage={false}
                  isStaticPage={true}
                  isEditable={false}
                  cells={layoutCells}
                  templates={tempVars}
                  timeRange={selfTimeRange}
                  manualRefresh={selfManulRefresh}
                  instance={renderInstance}
                  host={''}
                />
              </div>
            </div>
            <div className="dash-graph--gradient-border">
              <div className="dash-graph--gradient-top-left" />
              <div className="dash-graph--gradient-top-right" />
              <div className="dash-graph--gradient-bottom-left" />
              <div className="dash-graph--gradient-bottom-right" />
            </div>
          </>
        )}
      </div>
    )
  }

  private handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {onChooseAutoRefresh} = this.props
    const {milliseconds} = option
    onChooseAutoRefresh(milliseconds)
  }

  private handleChooseTimeRange = ({lower, upper}) => {
    if (upper) {
      this.setState({selfTimeRange: {lower, upper}})
    } else {
      const timeRange = timeRanges.find(range => range.lower === lower)
      this.setState({selfTimeRange: timeRange})
    }
  }
  private handleManualRefresh = (): void => {
    this.setState({
      selfManulRefresh: Date.now(),
    })
  }
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh},
    },
    links,
  } = state

  return {
    links,
    selfAutoRefrsh: autoRefresh,
  }
}

const mdtp = dispatch => ({
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
})
export default connect(mstp, mdtp, null)(OpenStackInstanceGraph)
