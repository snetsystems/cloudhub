import React, {useCallback, useEffect, useState} from 'react'
import _ from 'lodash'

// Type
import {INPUT_TIME_TYPE, Source, TimeRange, TimeZones} from 'src/types'
import {Alert} from 'src/types/alerts'
import {CloudAutoRefresh} from 'src/clouds/types/type'

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
import {
  setAlertHostList,
  setFilteredHexbin,
  setPredictionTimeRange,
} from 'src/device_management/actions'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

//Util
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {setArrayHostList} from 'src/device_management/utils'

interface Props {
  predictionTimeRange?: TimeRange
  source: Source
  limit: number

  timeZone?: TimeZones
  manualRefresh?: number
  alertHostList?: string[]
  histogramDate?: TimeRange
  filteredHexbinHost?: string
  cloudAutoRefresh?: CloudAutoRefresh
  setAlertHostList?: (value: string[]) => void
  setPredictionTimeRange?: (value: TimeRange) => void
}

function PredictionAlertHistoryWrapper({
  source,
  timeZone,
  histogramDate,
  manualRefresh,
  alertHostList,
  cloudAutoRefresh,
  setAlertHostList,
  filteredHexbinHost,
  predictionTimeRange,
  setPredictionTimeRange,
  limit = RECENT_ALERTS_LIMIT,
}: Props) {
  const [isAlertsMaxedOut, setIsAlertsMaxedOut] = useState(false)

  const [alertsData, setAlertsData] = useState<Alert[]>([])

  const [error, setError] = useState<unknown>()

  const [limitMultiplier, setLimitMultiplier] = useState(1)

  const [loading, setLoading] = useState(false)

  let intervalID

  const fetchAlerts = useCallback((): void => {
    getPredictionAlert(
      source.links.proxy,
      histogramDate ?? predictionTimeRange,
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
    histogramDate?.lower,
    predictionTimeRange.lower,
    source.links.proxy,
    filteredHexbinHost,
  ])

  // alert List get api
  useEffect(() => {
    fetchAlerts()
  }, [histogramDate, manualRefresh, fetchAlerts, filteredHexbinHost, timeZone])

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
    const alertHostListTemp = []
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
          isOk: s[levelIndex] === 'OK',
        })
      }
    })

    setAlertHostList(
      setArrayHostList([...alertHostListTemp].reverse(), alertHostList)
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
    return `${time.getFullYear()}-${time.getMonth() + 1}-${time.getDate()}`
  }

  return (
    <>
      <div style={{height: '100%', backgroundColor: '#292933'}}>
        <PredictionDashboardHeader
          cellName={
            <p>
              Anomaly Prediction History{' '}
              {!!histogramDate
                ? `Filtering: ${getDate(histogramDate?.lower)}`
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
          <div style={{zIndex: 3}} className="page-header--right">
            <Button
              text="Reset (30d)"
              color={ComponentColor.Primary}
              onClick={() => {
                setPredictionTimeRange({
                  lower: 'now() - 30d',
                  lowerFlux: '-30d',
                  upper: null,
                  format: INPUT_TIME_TYPE.RELATIVE_TIME,
                })
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
        />
      </div>
    </>
  )
}

const mstp = state => {
  const {
    predictionDashboard: {
      predictionTimeRange,
      alertHostList,
      histogramDate,
      filteredHexbinHost,
    },
    app: {
      persisted: {autoRefresh, cloudAutoRefresh, timeZone},
    },
  } = state

  return {
    autoRefresh,
    histogramDate,
    cloudAutoRefresh,
    predictionTimeRange,
    alertHostList,
    filteredHexbinHost,
    timeZone,
  }
}

const mdtp = (dispatch: any) => ({
  setPredictionTimeRange: bindActionCreators(setPredictionTimeRange, dispatch),
  setAlertHostList: bindActionCreators(setAlertHostList, dispatch),
  setFilteredHexbin: bindActionCreators(setFilteredHexbin, dispatch),
})

const areEqual = (prev, next) => {
  return prev === next
}
export default React.memo(
  connect(mstp, mdtp, null)(PredictionAlertHistoryWrapper),
  areEqual
)
