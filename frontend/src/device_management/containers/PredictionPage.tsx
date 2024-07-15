import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import PredictionDashBoard from '../components/PredictionDashBoard'
import {INPUT_TIME_TYPE, Source, TimeRange} from 'src/types'
import * as appActions from 'src/shared/actions/app'
import _ from 'lodash'
import {convertTimeFormat} from 'src/utils/timeSeriesTransformers'

interface Props {
  timeRange: TimeRange
  source: Source
  limit: number
  setTimeRange: (value: TimeRange) => void
}
function PredictionPage({timeRange, source, setTimeRange}: Props) {
  const [selectDate, setSelectDate] = useState<number>(null)

  useEffect(() => {
    selectDate &&
      setTimeRange({
        lower: convertTimeFormat(selectDate - 10000),
        upper: convertTimeFormat(selectDate + 86400000),
        format: INPUT_TIME_TYPE.TIMESTAMP,
      })
  }, [selectDate])

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
        host=""
        sources={[source]}
        setSelectDate={setSelectDate}
        setTimeRange={setTimeRange}
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

const areEqual = (prevProps, nextProps) => {
  if (
    JSON.stringify(prevProps.timeRange !== JSON.stringify(nextProps.timeRange))
  ) {
    return false
  }
  return prevProps.value === nextProps.value
}

export default React.memo(connect(mstp, mdtp, null)(PredictionPage), areEqual)

// export default AiSettingPage
