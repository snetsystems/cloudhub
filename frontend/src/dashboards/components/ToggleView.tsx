import React, {useState, useEffect, useMemo} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import LoadingDots from 'src/shared/components/LoadingDots'

import {BaseElasticSearchData} from 'src/types'

import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'
import {DEFAULT_CELL_BG_COLOR, DEFAULT_CELL_TEXT_COLOR} from '../constants'
import {setCloudAutoRefresh, setCloudTimeRange} from 'src/clouds/actions/clouds'
import _ from 'lodash'

import * as appActions from 'src/shared/actions/app'
import {ComponentSize, SlideToggle} from 'src/reusable_ui'
import {CloudTimeRange} from 'src/clouds/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
export interface ViewConfig {
  key: string
  label: string
  Component: React.ComponentType<any>
  props?: any
  fetchData?: (esSrc: BaseElasticSearchData) => Promise<any>
}

export interface ToggleViewOwnProps {
  loading: boolean
  views: ViewConfig[]
  autoRefreshInterval?: number
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
}: ToggleViewProps) {
  const [activeKey, setActiveKey] = useState(views[0]?.key)
  const activeView = useMemo(() => views.find(v => v.key === activeKey)!, [
    activeKey,
    views,
  ])

  let intervalID

  useEffect(() => {
    activeView.fetchData?.(esSource)
  }, [cloudAutoRefresh.logAnalysis])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.logAnalysis)
    const controller = new AbortController()

    if (!!cloudAutoRefresh.logAnalysis) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        activeView.fetchData?.(esSource)
      }, cloudAutoRefresh.logAnalysis)
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh.logAnalysis)

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh.logAnalysis])

  const renderToggle = () => {
    if (views.length !== 2) return null
    const [first, second] = views
    const isSecondActive = activeKey === second.key
    return (
      <>
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{zIndex: 3}}
          className={`prediction ${
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
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#292933',
      }}
    >
      <LogAnalysisDashboardHeader
        cellName="Log Analysis TreeMap"
        cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
        cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      >
        {loading && (
          <LoadingDots className="graph-panel__refreshing openstack-dots--loading" />
        )}
        {renderToggle()}
      </LogAnalysisDashboardHeader>
      <div style={{width: '100%', height: 'calc(100% - 40px)'}}>
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
