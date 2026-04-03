import React, {useCallback, useEffect, useState} from 'react'
import _ from 'lodash'

// Type
import {
  AlertHostList,
  HostState,
  INPUT_TIME_TYPE,
  Source,
  TimeRange,
  TimeZones,
} from 'src/types'
import {Alert} from 'src/types/alerts'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types/type'

// Components
import PredictionAlertTable from 'src/device_management/components/PredictionAlertTable'
import {Button, ComponentColor} from 'src/reusable_ui'
import LoadingDots from 'src/shared/components/LoadingDots'

// Constant
import {RECENT_ALERTS_LIMIT} from 'src/status/constants'
import PredictionDashboardHeader from 'src/device_management/components/PredictionDashboardHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

// API
import {getPredictionAlert} from 'src/device_management/apis'

// Redux
import {setAlertHostList} from 'src/device_management/actions'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

//Util
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {setArrayHostList} from 'src/device_management/utils'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {timeRanges} from 'src/shared/data/timeRanges'

interface Props {
  source: Source
  limit: number
  timeZone?: TimeZones
  histogramDate?: TimeRange
  alertHostList?: AlertHostList
  filteredHexbinHost?: string
  cloudTimeRange?: CloudTimeRange
  predictionManualRefresh?: number
  cloudAutoRefresh?: CloudAutoRefresh
  setAlertHostList?: (value: AlertHostList) => void
  onChooseCloudTimeRange?: (value: CloudTimeRange) => void
}

function PredictionAlertHistoryWrapper({
  source,
  timeZone,
  histogramDate,
  cloudTimeRange,
  cloudAutoRefresh,
  filteredHexbinHost,
  onChooseCloudTimeRange,
  predictionManualRefresh,
  alertHostList,
  setAlertHostList,
  limit = RECENT_ALERTS_LIMIT,
}: Props) {
  const [isAlertsMaxedOut, setIsAlertsMaxedOut] = useState(false)
  const [alertsData, setAlertsData] = useState<Alert[]>([])
  const [error, setError] = useState<unknown>()
  const [limitMultiplier, setLimitMultiplier] = useState(1)
  const [loading, setLoading] = useState(false)
  const [manualReset, setManualReset] = useState(0)

  let intervalID

  const fetchAlerts = useCallback((): void => {
    const timeRange =
      histogramDate ??
      cloudTimeRange?.prediction ??
      timeRanges.find(i => i.inputValue === 'Past 30d')

    getPredictionAlert(
      source.links.proxy,
      timeRange,
      limit * limitMultiplier,
      source.telegraf
    )
      .then(resp => {
        const alertSeries = _.get(resp, ['data', 'results', '0', 'series'], [])
        if (alertSeries.length === 0) {
          setLoading(false)
          setAlertsData([])
          return
        }

        makeAlertsData(alertSeries)
        setError(false)
        setLoading(false)
      })
      .catch(e => {
        setError(e)
        setLoading(false)
        setAlertsData([])
        setIsAlertsMaxedOut(false)
      })
  }, [
    limitMultiplier,
    histogramDate,
    cloudTimeRange?.prediction,
    source.links.proxy,
    filteredHexbinHost,
    source.telegraf,
  ])

  useEffect(() => {
    fetchAlerts()
  }, [
    histogramDate,
    fetchAlerts,
    filteredHexbinHost,
    timeZone,
    predictionManualRefresh,
  ])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.prediction)
    const controller = new AbortController()

    if (!!cloudAutoRefresh.prediction) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        fetchAlerts()
      }, cloudAutoRefresh.prediction)
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh.prediction)

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh, fetchAlerts])

  const makeAlertsData = alertSeries => {
    const results = []

    const timeIndex = alertSeries[0].columns.findIndex(col => col === 'time')
    const hostIndex = alertSeries[0].columns.findIndex(
      col => col === 'agent_host'
    )
    const valueIndex = alertSeries[0].columns.findIndex(col => col === 'value')
    const levelIndex = alertSeries[0].columns.findIndex(col => col === 'level')
    const nameIndex = alertSeries[0].columns.findIndex(
      col => col === 'alertName'
    )
    const triggerTypeIndex = alertSeries[0].columns.findIndex(
      col => col === 'triggerType'
    )
    const alertHostListTemp: HostState[] = []

    alertSeries[0].values.forEach(s => {
      if (s[triggerTypeIndex] === 'anomaly_predict') {
        results.push({
          time: `${s[timeIndex]}`,
          host: s[hostIndex],
          value: `${s[valueIndex]}`,
          level: s[levelIndex],
          name: `${s[nameIndex]}`,
          triggerType: `${s[triggerTypeIndex]}`,
        })

        alertHostListTemp.push({
          host: s[hostIndex],
          level: s[levelIndex],
          isOk: s[levelIndex] === 'OK',
        })
      }
    })

    setAlertHostList(
      setArrayHostList(alertHostListTemp.reverse(), alertHostList)
    )
    setAlertsData(filterSelectedHost(results))
    setIsAlertsMaxedOut(results.length !== limit * limitMultiplier)
  }

  const filterSelectedHost = (alerts: Alert[]) => {
    if (!!filteredHexbinHost) {
      return alerts.filter(i => i.host === filteredHexbinHost)
    } else {
      return alerts
    }
  }

  const getDate = (date: string) => {
    const time = new Date(date)
    const year = time.getFullYear()
    const month = String(time.getMonth() + 1).padStart(2, '0')
    const day = String(time.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDateRange = (histogramDate: TimeRange) => {
    if (!histogramDate?.lower) return ''

    const startDate = getDate(histogramDate.lower)
    if (!histogramDate.upper) {
      return startDate
    }

    const endDate = getDate(
      new Date(new Date(histogramDate.upper).getTime() - 86400000).toISOString()
    )

    if (startDate === endDate) {
      return startDate
    }

    return `${startDate} ~ ${endDate}`
  }

  const onClickReset = () => {
    onChooseCloudTimeRange({
      prediction: {
        lower: 'now() - 30d',
        lowerFlux: '-30d',
        upper: null,
        format: INPUT_TIME_TYPE.RELATIVE_TIME,
      },
    })

    setManualReset(Date.now())
  }

  return (
    <>
      <div className="prediction-wrapper">
        <PredictionDashboardHeader
          cellName={
            <p>
              Anomaly Prediction History{' '}
              {histogramDate
                ? `– Filtering: ${getDateRange(histogramDate)}`
                : ''}
            </p>
          }
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div className="dash-graph--name">
            {!!loading && (
              <LoadingDots
                className={'graph-panel__refreshing openstack-dots--loading'}
              />
            )}
          </div>
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{zIndex: 3}}
            className="page-header--right"
          >
            <Button
              text="Reset (30d)"
              color={ComponentColor.Primary}
              onClick={() => {
                onClickReset()
              }}
            />
          </div>
        </PredictionDashboardHeader>
        <PredictionAlertTable
          source={source}
          isWidget={true}
          limit={limit}
          alerts={alertsData}
          error={error}
          fetchAlerts={fetchAlerts}
          isAlertsMaxedOut={isAlertsMaxedOut}
          setLimitMultiplier={setLimitMultiplier}
          manualReset={manualReset}
        />
      </div>
    </>
  )
}

const mstp = state => {
  const {
    predictionDashboard: {
      alertHostList,
      filteredHexbinHost,
      predictionManualRefresh,
      histogramDate,
    },
    app: {
      persisted: {autoRefresh, cloudTimeRange, cloudAutoRefresh, timeZone},
    },
  } = state

  return {
    autoRefresh,
    histogramDate,
    alertHostList,
    cloudAutoRefresh,
    filteredHexbinHost,
    timeZone,
    cloudTimeRange,
    predictionManualRefresh,
  }
}

const mdtp = (dispatch: any) => ({
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  setAlertHostList: bindActionCreators(setAlertHostList, dispatch),
})

const areEqual = (prev, next) => {
  return prev === next
}
export default React.memo(
  connect(mstp, mdtp, null)(PredictionAlertHistoryWrapper),
  areEqual
)
