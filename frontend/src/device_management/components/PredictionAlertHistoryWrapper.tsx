import React, {useEffect, useState} from 'react'
import {Cell, Source, TimeRange} from 'src/types'
import {Alert} from 'src/types/alerts'
import PredictionAlertTable from './PredictionAlertTable'
import {RECENT_ALERTS_LIMIT} from 'src/status/constants'
import PredictionDashboardHeader from './PredictionDashboardHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import LoadingDots from 'src/shared/components/LoadingDots'
import AJAX from 'src/utils/ajax'
import {getPredictionAlert} from '../apis'
import _ from 'lodash'

interface Props {
  timeRange: TimeRange
  source: Source
  limit: number
}

function PredictionAlertHistoryWrapper({
  timeRange,
  source,
  limit: prevLimit,
}: Props) {
  const [isAlertsMaxedOut, setIsAlertsMaxedOut] = useState(false)

  const [alertsData, setAlertsData] = useState<Alert[]>([])

  const [hasKapacitor, setHasKapacitor] = useState(false)

  const [error, setError] = useState<unknown>()

  const [limit, setLimit] = useState(prevLimit ?? 30)

  const [limitMultiplier, setLimitMultiplier] = useState(1)

  const [loading, setLoading] = useState(false)

  // alert List get api
  useEffect(() => {
    AJAX({
      url: source.links?.kapacitors ?? '',
      method: 'GET',
    })
      .then(({data}) => {
        if (!!data.kapacitors[0]) {
          setHasKapacitor(true)
          fetchAlerts()
        } else {
          setLoading(false)
        }
      })
      .catch(e => {
        setLoading(false)
        setError(e)
      })
  }, [timeRange])

  //TODO: timerange var change to redux data not props -> why?
  const fetchAlerts = (): void => {
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
  }

  const makeAlertsData = alertSeries => {
    const results = []

    const timeIndex = alertSeries[0].columns.findIndex(col => col === 'time')
    const hostIndex = alertSeries[0].columns.findIndex(col => col === 'host')
    const valueIndex = alertSeries[0].columns.findIndex(col => col === 'value')
    const levelIndex = alertSeries[0].columns.findIndex(col => col === 'level')
    const nameIndex = alertSeries[0].columns.findIndex(
      col => col === 'alertName'
    )

    alertSeries[0].values.forEach(s => {
      results.push({
        time: `${s[timeIndex]}`,
        host: s[hostIndex],
        value: `${s[valueIndex]}`,
        level: s[levelIndex],
        name: `${s[nameIndex]}`,
      })
    })

    setAlertsData(results)
    setIsAlertsMaxedOut(results.length !== limit * limitMultiplier)
  }

  return (
    <>
      <div style={{height: '100%', backgroundColor: '#292933'}}>
        <PredictionDashboardHeader
          cellName={`Anomaly Prediction History`}
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
        </PredictionDashboardHeader>
        <PredictionAlertTable
          source={source}
          timeRange={timeRange}
          isWidget={true}
          limit={RECENT_ALERTS_LIMIT}
          alerts={alertsData}
          error={error}
          fetchAlerts={fetchAlerts}
          hasKapacitor={hasKapacitor}
          isAlertsMaxedOut={isAlertsMaxedOut}
          setLimitMultiplier={setLimitMultiplier}
        />
      </div>
    </>
  )

  //   alerts={alertsData}
  //   error={error}
  //   fetchAlerts={fetchAlerts}
  //   hasKapacitor={hasKapacitor}
  //   isAlertsMaxedOut={isAlertsMaxedOut}
  //   loading={loading}
  //   setLimitMultiplier={setLimitMultiplier}
}

const areEqual = (prevProps, nextProps) => {
  return prevProps.value === nextProps.value
}

export default React.memo(PredictionAlertHistoryWrapper, areEqual)
