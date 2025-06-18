import React, {useState, useEffect, useMemo, ChangeEvent, useRef} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import LoadingDots from 'src/shared/components/LoadingDots'

import {BaseElasticSearchData} from 'src/types'

import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import {setCloudAutoRefresh, setCloudTimeRange} from 'src/clouds/actions/clouds'
import _, {debounce} from 'lodash'

import * as appActions from 'src/shared/actions/app'
import {
  ComponentSize,
  IconFont,
  Input,
  InputType,
  SlideToggle,
} from 'src/reusable_ui'
import {CloudTimeRange} from 'src/clouds/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {useLocalStorage} from 'src/log_analysis/hooks/useLocalStorage'
import {LOG_ANALYSIS_LOCAL_STORAGE_KEY} from 'src/log_analysis/constants'

export interface ViewConfig {
  key: string
  label: string
  Component: React.ComponentType<any>
  props?: any
  fetchData?: (esSrc: BaseElasticSearchData, topN: number) => Promise<any>
  topN?: number
}

export interface ToggleViewOwnProps {
  loading: boolean
  views: ViewConfig[]
  autoRefreshInterval?: number
  topN?: number
  isMoreFetch: boolean
  onChangeTopN?: (e: ChangeEvent<HTMLInputElement>) => void
  handleOnBlur?: () => void
}

interface StateProps {
  autoRefresh: number
  cloudAutoRefresh: CloudAutoRefresh
  cloudTimeRange: CloudTimeRange
  esSource: BaseElasticSearchData
}
interface DispatchProps {}

type ToggleViewProps = ToggleViewOwnProps & StateProps & DispatchProps

function ToggleView<P>({
  esSource,
  loading,
  views,
  cloudAutoRefresh,
  cloudTimeRange,
  topN = 100,
  isMoreFetch,
  onChangeTopN,
  handleOnBlur,
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

  const fetchTokenDataDebounced = useRef(
    debounce((src: BaseElasticSearchData, topN: number) => {
      activeView.fetchData?.(src, topN)
    }, 1000)
  ).current

  useEffect(() => {
    if (!isMoreFetch) return
    if (_.isEmpty(esSource)) return

    fetchTokenDataDebounced(esSource, topN)
  }, [isMoreFetch, esSource, topN])

  useEffect(() => {
    return () => {
      fetchTokenDataDebounced.cancel()
    }
  }, [fetchTokenDataDebounced])

  useEffect(() => {
    if (_.isEmpty(esSource)) return

    activeView.fetchData?.(esSource, topN)
  }, [cloudAutoRefresh.logAnalysis, topN, esSource])

  useEffect(() => {
    if (_.isEmpty(esSource)) return

    GlobalAutoRefresher.poll(cloudAutoRefresh.logAnalysis)
    const controller = new AbortController()

    if (!!cloudAutoRefresh.logAnalysis) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        activeView.fetchData?.(esSource, topN)
      }, cloudAutoRefresh.logAnalysis)
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh.logAnalysis)

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh.logAnalysis, topN, esSource])

  const renderToggle = () => {
    if (views.length !== 2) return null
    const [first, second] = views
    const isSecondActive = activeKey === second.key
    return (
      <>
        <div
          onMouseDown={e => e.stopPropagation()}
          className={`z-index-3 prediction ${
            isSecondActive ? 'page-header--left' : 'page-header--right'
          } `}
        >
          <div
            className={`header ${
              isSecondActive ? 'page-header--left' : 'page-header--right'
            }`}
          >
            <label className="hexbin-header--label">
              {isSecondActive ? second.label : first.label}
            </label>
            <SlideToggle
              active={isSecondActive}
              onChange={() =>
                setActiveKey(isSecondActive ? first.key : second.key)
              }
              size={ComponentSize.ExtraSmall}
            />
          </div>
        </div>
      </>
    )
  }
  return (
    <div className="w-full h-full background-grid-header">
      <LogAnalysisDashboardHeader
        cellName="Log Analysis TreeMap"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        {loading && (
          <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
        )}
        <div className="toggle-view--header---filter">
          <Input
            icon={IconFont.Filter}
            size={ComponentSize.ExtraSmall}
            type={InputType.Number}
            onChange={onChangeTopN}
            value={topN.toString()}
            min={1}
            max={1000}
            onBlur={handleOnBlur}
          />
        </div>
        {renderToggle()}
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
      persisted: {
        timeZone,
        autoRefresh,
        cloudAutoRefresh,
        cloudTimeRange,
        esSource,
      },
    },
  } = state

  return {
    inPresentationMode,
    timeZone,
    autoRefresh,
    cloudAutoRefresh,
    cloudTimeRange,
    esSource,
  }
}

const mdtp = dispatch => ({
  setCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),
})

const isEqual = (prev, next) => {
  return _.isEqual(prev, next)
}

export default React.memo(connect(mstp, mdtp)(ToggleView), isEqual)
