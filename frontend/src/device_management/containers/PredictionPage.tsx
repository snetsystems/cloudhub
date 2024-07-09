import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import PredictionDashBoard from '../components/PredictionDashBoard'
import {Source, TimeRange} from 'src/types'
import AJAX from 'src/utils/ajax'
import {Alert} from 'src/types/alerts'
import * as appActions from 'src/shared/actions/app'
import _ from 'lodash'
import {getPredictionAlert} from '../apis'

interface Props {
  timeRange: TimeRange
  source: Source
  limit: number
  setTimeRange: (value: TimeRange) => void
}
function PredictionPage({
  timeRange,
  source,
  limit: prevLimit,
  setTimeRange,
}: Props) {
  const [selectDate, setSelectDate] = useState<number>(null)

  const [isAlertsMaxedOut, setIsAlertsMaxedOut] = useState(false)

  const [alert, setAlert] = useState(null)

  const [alertsData, setAlertsData] = useState<Alert[]>([])

  const [hasKapacitor, setHasKapacitor] = useState(false)

  const [error, setError] = useState<unknown>()

  const [limit, setLimit] = useState(30)

  const [limitMultiplier, setLimitMultiplier] = useState(1)

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    selectDate &&
      alert.length &&
      setTimeRange({
        lower: convertTimeFormat(selectDate - 10000),
        upper: convertTimeFormat(selectDate + 86400000),
      })
  }, [selectDate])

  // alert List get api
  useEffect(() => {
    setLimit(prevLimit ?? 30)

    setSelectDate(null)

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

  function convertTimeFormat(dateString) {
    const date = new Date(dateString)
    return date.toISOString()
  }

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

        setAlert(alertSeries)

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

  // const filterFetchAlerts = selectDate => {
  //   const timeIndex = alert[0].columns.findIndex(col => col === 'time')
  //   const result = alert[0]?.values?.filter(i => {
  //     if (
  //       i[timeIndex] > selectDate - 43200000 &&
  //       i[timeIndex] < selectDate + 43200000
  //     ) {
  //       console.log(i[timeIndex], selectDate)
  //       return true
  //     } else {
  //       return false
  //     }
  //   })

  //   console.log('result', result)
  // }

  return (
    <>
      <PredictionDashBoard
        source={source}
        timeRange={timeRange}
        inPresentationMode={true}
        alerts={alertsData}
        error={error}
        fetchAlerts={fetchAlerts}
        hasKapacitor={hasKapacitor}
        isAlertsMaxedOut={isAlertsMaxedOut}
        loading={loading}
        setLimitMultiplier={setLimitMultiplier}
        host=""
        sources={[source]}
        setSelectDate={setSelectDate}
      />
    </>
  )
}

const mstp = ({
  app: {
    persisted: {timeZone},
  },
  auth: {isUsingAuth},
}) => {
  return {
    isUsingAuth,
    timeZone,
  }
}

const mdtp = {
  setTimeZone: appActions.setTimeZone,
}

export default connect(mstp, mdtp, null)(PredictionPage)

// export default AiSettingPage
