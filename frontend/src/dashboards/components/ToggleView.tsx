import React, {useState, useEffect, useMemo} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import LoadingDots from 'src/shared/components/LoadingDots'

import PredictionHexbinToggle from 'src/device_management/components/PredictionHexbinToggle'
import {Source, Links, NotificationAction} from 'src/types'
import {CloudAutoRefresh} from 'src/clouds/types/type'
import {setFilteredHexbin} from 'src/device_management/actions'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import LogAnalysisDashboardHeader from 'src/log_analysis/components/LogAnalysisDashboardHeader'
import {DEFAULT_CELL_BG_COLOR, DEFAULT_CELL_TEXT_COLOR} from '../constants'

export interface ViewConfig<P = {}> {
  key: string
  label: string
  Component: React.ComponentType<any>
  props?: any
  fetchData?: () => Promise<any>
}

export interface ToggleViewOwnProps<P = {}> {
  source: Source
  loading: boolean
  views: ViewConfig<P>[]
  autoRefreshInterval?: number
}

interface StateProps {
  cloudAutoRefresh: CloudAutoRefresh
  predictionManualRefresh: number
}
interface DispatchProps {
  notify: NotificationAction
  setFilteredHexbin: typeof setFilteredHexbin
}

type ToggleViewProps<P> = ToggleViewOwnProps<P> & StateProps & DispatchProps

function ToggleView<P>({
  source,
  loading,
  views,
  autoRefreshInterval = 0,
  cloudAutoRefresh,
  predictionManualRefresh,
}: ToggleViewProps<P>) {
  const [activeKey, setActiveKey] = useState(views[0]?.key)
  const activeView = useMemo(() => views.find(v => v.key === activeKey)!, [
    activeKey,
    views,
  ])

  useEffect(() => {
    activeView.fetchData?.()
  }, [predictionManualRefresh, activeView])

  useEffect(() => {
    const interval = autoRefreshInterval || cloudAutoRefresh.prediction
    if (!interval) return
    const id = window.setInterval(() => {
      activeView.fetchData?.()
    }, interval)
    return () => clearInterval(id)
  }, [activeKey, activeView, autoRefreshInterval, cloudAutoRefresh])

  const renderToggle = () => {
    if (views.length !== 2) return null
    const [first, second] = views
    const isSecondActive = activeKey === second.key
    return (
      <PredictionHexbinToggle
        label={isSecondActive ? second.label : first.label}
        isActive={isSecondActive}
        onChange={() => setActiveKey(isSecondActive ? first.key : second.key)}
        isLeft={!isSecondActive}
      />
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#292933',
        overflow: 'hidden',
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

      <activeView.Component {...(activeView.props as P)} />
    </div>
  )
}

const mapStateToProps = state => ({
  cloudAutoRefresh: state.app.persisted.cloudAutoRefresh,
  predictionManualRefresh: state.predictionDashboard.predictionManualRefresh,
})
const mapDispatchToProps = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
  setFilteredHexbin: bindActionCreators(setFilteredHexbin, dispatch),
})

export default connect(mapStateToProps, mapDispatchToProps)(ToggleView)
