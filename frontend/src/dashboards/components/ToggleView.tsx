//Library
import React, {useEffect, useMemo, ChangeEvent} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

//Components
import LoadingDots from 'src/shared/components/LoadingDots'

//Types
import {BaseElasticSearchData, FilteredLogsForLogAnalysis} from 'src/types'

//Components
import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

//Actions
import {setCloudAutoRefresh, setCloudTimeRange} from 'src/clouds/actions/clouds'

//Utils
import _ from 'lodash'

//Redux
import * as appActions from 'src/shared/actions/app'
import {ComponentSize, InputType, SlideToggle} from 'src/reusable_ui'

//Types
import {CloudTimeRange} from 'src/clouds/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'

//Utils
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

//Hooks
import {useLocalStorage} from 'src/log_analysis/hooks/useLocalStorage'
import {LOG_ANALYSIS_LOCAL_STORAGE_KEY} from 'src/log_analysis/constants'
import {setFilteredLogForLogAnalysis} from 'src/log_analysis/actions'

export interface ViewConfig {
  key: string
  label: string
  Component: React.ComponentType<any>
  props?: any
  fetchData?: (
    esSrc: BaseElasticSearchData,
    topN: number,
    cloudTimeRange?: CloudTimeRange,
    filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
  ) => Promise<any>
  localTopN?: number
}

export interface ToggleViewOwnProps {
  loading: boolean
  views: ViewConfig[]
  autoRefreshInterval?: number
  topN?: number
  localTopN?: number
  onChangeTopN?: (number: number) => void
  handleOnBlur?: () => void
}

interface StateProps {
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange?: CloudTimeRange
  filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
  esSource: BaseElasticSearchData
  logAnalysisManualRefresh?: number
}
interface DispatchProps {}

type ToggleViewProps = ToggleViewOwnProps & StateProps & DispatchProps

function ToggleView<P>({
  esSource,
  loading,
  views,
  cloudAutoRefresh,
  filteredLogsForLogAnalysis,
  cloudTimeRange,
  topN = 100,
  localTopN = 100,
  onChangeTopN,
  handleOnBlur,
  logAnalysisManualRefresh,
}: ToggleViewProps) {
  const [storageObj, setStorageObj] = useLocalStorage<{activeView: string}>(
    LOG_ANALYSIS_LOCAL_STORAGE_KEY,
    {
      activeView: views[0]?.key,
    }
  )

  const activeKey = storageObj.activeView

  const setActiveKey = (value: string) =>
    setStorageObj(prev => ({...prev, activeView: value}))
  const activeView = useMemo(() => views.find(v => v.key === activeKey)!, [
    activeKey,
    views,
  ])
  let intervalID

  const handleTopNChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    onChangeTopN?.(value)
  }

  useEffect(() => {
    if (_.isEmpty(esSource)) return
    activeView.fetchData?.(
      esSource,
      localTopN,
      cloudTimeRange,
      filteredLogsForLogAnalysis
    )
  }, [
    esSource,
    logAnalysisManualRefresh,
    cloudTimeRange?.logAnalysis,
    localTopN,
    filteredLogsForLogAnalysis,
  ])

  useEffect(() => {
    if (_.isEmpty(esSource)) return

    GlobalAutoRefresher.poll(cloudAutoRefresh.logAnalysis)
    const controller = new AbortController()

    if (!!cloudAutoRefresh.logAnalysis) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        activeView.fetchData?.(
          esSource,
          localTopN,
          cloudTimeRange,
          filteredLogsForLogAnalysis
        )
      }, cloudAutoRefresh.logAnalysis)
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh.logAnalysis)

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [
    cloudAutoRefresh.logAnalysis,
    esSource,
    cloudTimeRange?.logAnalysis,
    filteredLogsForLogAnalysis,
    logAnalysisManualRefresh,
    localTopN,
  ])

  const renderToggle = () => {
    if (views.length !== 2) return null
    const [first, second] = views
    const isSecondActive = activeKey === second.key
    return (
      <>
        <div
          onMouseDown={e => e.stopPropagation()}
          className={'toggle-view--toggle'}
        >
          <SlideToggle
            active={isSecondActive}
            onChange={() =>
              setActiveKey(isSecondActive ? first.key : second.key)
            }
            size={ComponentSize.ExtraSmall}
          />
        </div>
      </>
    )
  }
  return (
    <div className="w-full h-full toggle-view--header">
      <LogAnalysisDashboardHeader
        cellName={`Log ${activeView.label}`}
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        {loading && (
          <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
        )}
        {renderToggle()}
        <div className="toggle-view--header---filter">
          <div className="search-widget" style={{width: '120px'}}>
            <input
              onMouseDown={e => e.stopPropagation()}
              type={InputType.Number}
              className="form-control input-sm"
              placeholder="Filter Tokens..."
              onChange={handleTopNChange}
              min={1}
              max={1000}
              onBlur={handleOnBlur}
              value={`${topN}`}
            />
            <span className="icon filter" />
          </div>
        </div>
      </LogAnalysisDashboardHeader>
      <div className="toggle-view--content">
        <activeView.Component {...(activeView.props as P)} />
      </div>
    </div>
  )
}

const mstp = state => {
  const {
    app: {
      ephemeral: {inPresentationMode},
      persisted: {timeZone, cloudAutoRefresh, cloudTimeRange, esSource},
    },
    logAnalysisDashboard: {
      filteredLogsForLogAnalysis,
      logAnalysisManualRefresh,
    },
  } = state

  return {
    inPresentationMode,
    timeZone,
    cloudAutoRefresh,
    cloudTimeRange,
    esSource,
    filteredLogsForLogAnalysis,
    logAnalysisManualRefresh,
  }
}

const mdtp = dispatch => ({
  setCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),
  setFilteredLogForLogAnalysis: bindActionCreators(
    setFilteredLogForLogAnalysis,
    dispatch
  ),
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(connect(mstp, mdtp)(ToggleView), isEqual)
