import _ from 'lodash'
import React, {useEffect, useState} from 'react'
import NoKapacitorError from 'src/shared/components/NoKapacitorError'
import PageSpinner from 'src/shared/components/PageSpinner'
import {Source, TimeRange} from 'src/types'
import {Alert} from 'src/types/alerts'
import AJAX from 'src/utils/ajax'
import dummy from '../constants/dummy.json'
import PredictionAlertTableBody from './PredictionAlertTableBody'

interface Props {
  source: Source
  isWidget: boolean
  limit?: number
  timeRange?: TimeRange
}

function PredictionAlertTable({
  source,
  isWidget,
  limit: propsLimit,
  timeRange,
}: Props) {
  const [isAlertsMaxedOut, setIsAlertsMaxedOut] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [hasKapacitor, setHasKapacitor] = useState(false)
  const [error, setError] = useState<unknown>()
  const [limit, setLimit] = useState(propsLimit ?? 30)
  const [limitMultiplier, setLimitMultiplier] = useState(1)
  const [loading, setLoading] = useState(false)

  //router 에서 fetch 하고 결과만 props로 가져오면 Refetch issue를 고칠 수 있을 것 같다.
  useEffect(() => {
    fetchAlerts()
    AJAX({
      url: source.links?.kapacitors ?? '',
      method: 'GET',
    })
      .then(({data}) => {
        if (!!data.kapacitors[0]) {
          console.log('source: ', source)
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
  }, [])

  const fetchAlerts = (): void => {
    const results = []

    const alertSeries = _.get(dummy, ['results', '0', 'series'], [])
    if (alertSeries.length === 0) {
      setLoading(false)
      setAlerts([])
      return
    }

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

    // TODO: factor these setStates out to make a pure function and implement true limit & offset
    setError(false)
    setLoading(false)
    setAlerts(results)
    setIsAlertsMaxedOut(results.length !== limit * limitMultiplier)

    // getAlerts(
    //   source.links.proxy,
    //   timeRange,
    //   limit * limitMultiplier,
    //   source.telegraf
    // )
    //   .then(resp => {
    //     const results = []

    //     const alertSeries = _.get(resp, ['data', 'results', '0', 'series'], [])
    //     if (alertSeries.length === 0) {
    //       setLoading(false)
    //       setAlerts([])
    //       return
    //     }

    //     const timeIndex = alertSeries[0].columns.findIndex(
    //       col => col === 'time'
    //     )
    //     const hostIndex = alertSeries[0].columns.findIndex(
    //       col => col === 'host'
    //     )
    //     const valueIndex = alertSeries[0].columns.findIndex(
    //       col => col === 'value'
    //     )
    //     const levelIndex = alertSeries[0].columns.findIndex(
    //       col => col === 'level'
    //     )
    //     const nameIndex = alertSeries[0].columns.findIndex(
    //       col => col === 'alertName'
    //     )

    //     alertSeries[0].values.forEach(s => {
    //       results.push({
    //         time: `${s[timeIndex]}`,
    //         host: s[hostIndex],
    //         value: `${s[valueIndex]}`,
    //         level: s[levelIndex],
    //         name: `${s[nameIndex]}`,
    //       })
    //     })

    //     // TODO: factor these setStates out to make a pure function and implement true limit & offset
    //     setError(false)
    //     setLoading(false)
    //     setAlerts(results)
    //     setIsAlertsMaxedOut(results.length !== limit * limitMultiplier)
    //   })
    //   .catch(e => {
    //     setError(e)
    //     setLoading(false)
    //     setAlerts([])
    //     setIsAlertsMaxedOut(false)
    //   })
  }

  const handleGetMoreAlerts = (): void => {
    setLimitMultiplier(prev => prev + 1)

    fetchAlerts()
  }

  //tsx render
  const renderSubComponents = () => {
    if (error) {
      return (
        <>
          <div>{error.toString()}</div>
          <div>Check console logs.</div>
        </>
      )
    }

    if (loading || !source) {
      return <PageSpinner />
    }

    return hasKapacitor ? (
      <div
        style={{
          height: 'calc(100% - 45px)',
        }}
      >
        <PredictionAlertTableBody
          limit={limit}
          source={source}
          alerts={alerts}
          shouldNotBeFilterable={isWidget}
          onGetMoreAlerts={handleGetMoreAlerts}
          isAlertsMaxedOut={isAlertsMaxedOut}
          alertsCount={alerts.length}
        />
      </div>
    ) : (
      <NoKapacitorError source={source} />
    )
  }

  return <>{renderSubComponents()}</>
}

export default PredictionAlertTable
