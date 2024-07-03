import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import PredictionDashBoard from '../components/PredictionDashBoard'
import {Source, TimeRange} from 'src/types'
import AJAX from 'src/utils/ajax'
import {getAlerts} from 'src/alerts/apis'
import {Alert} from 'src/types/alerts'
import _ from 'lodash'

interface Props {
  timeRange: TimeRange
  source: Source
  limit: number
}
function PredictionPage({timeRange, source, limit: prevLimit}: Props) {
  const [isAlertsMaxedOut, setIsAlertsMaxedOut] = useState(false)

  const [alerts, setAlerts] = useState<Alert[]>([])

  const [hasKapacitor, setHasKapacitor] = useState(false)

  const [error, setError] = useState<unknown>()

  const [limit, setLimit] = useState(30)

  const [limitMultiplier, setLimitMultiplier] = useState(1)

  const [loading, setLoading] = useState(false)

  // alert List get api
  useEffect(() => {
    setLimit(prevLimit ?? 30)

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

  //TODO: timerange var change to redux data not props
  const fetchAlerts = (): void => {
    getAlerts(
      source.links.proxy,
      timeRange,
      limit * limitMultiplier,
      source.telegraf
    )
      .then(resp => {
        const results = []

        const alertSeries = _.get(resp, ['data', 'results', '0', 'series'], [])
        if (alertSeries.length === 0) {
          setLoading(false)
          setAlerts([])
          return
        }

        const timeIndex = alertSeries[0].columns.findIndex(
          col => col === 'time'
        )
        const hostIndex = alertSeries[0].columns.findIndex(
          col => col === 'host'
        )
        const valueIndex = alertSeries[0].columns.findIndex(
          col => col === 'value'
        )
        const levelIndex = alertSeries[0].columns.findIndex(
          col => col === 'level'
        )
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

        // TODO: factor these setStates out to make a pure function and implement true limit & offset
        setError(false)
        setLoading(false)
        setAlerts(results)
        setIsAlertsMaxedOut(results.length !== limit * limitMultiplier)
      })
      .catch(e => {
        setError(e)
        setLoading(false)
        setAlerts([])
        setIsAlertsMaxedOut(false)
      })
  }

  return (
    <>
      <PredictionDashBoard
        source={source}
        timeRange={timeRange}
        inPresentationMode={true}
        alerts={alerts}
        error={error}
        fetchAlerts={fetchAlerts}
        hasKapacitor={hasKapacitor}
        isAlertsMaxedOut={isAlertsMaxedOut}
        loading={loading}
        setLimitMultiplier={setLimitMultiplier}
        host=""
        manualRefresh={0}
        sources={[source]}
      />
    </>
  )
}

export default connect(null)(PredictionPage)
// export default AiSettingPage
