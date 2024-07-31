import React, {useEffect, useMemo, useState} from 'react'
import {GetLearningDLData} from 'src/types'
import {getLearningRstDL} from 'src/device_management//apis'

import {DLNxRstChart} from 'src/device_management/components/PredictionModalDLContent'

interface Props {
  host: string
}
function PredictionModalDLChart({host}: Props) {
  const [dlResultData, setDlResultData] = useState<GetLearningDLData>()

  const [noData, setNoData] = useState(true)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDlData(host)
  }, [host])

  const getDlData = async (host: string) => {
    try {
      const result = await getLearningRstDL(host)
      if (!result) {
        setNoData(true)
      } else {
        setDlResultData(result.data)
        setNoData(false)
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  //Dl-tran,valid First Chart

  const dlTrainData = useMemo(() => {
    return {
      label: 'Train loss',
      data: dlResultData?.train_loss?.map(item => {
        return item
      }),
      backgroundColor: 'rgba(45, 199, 232, 1)',
      order: 2,
      pointRadius: 1,
      borderColor: 'rgba(45, 199, 232, 1)',
    }
  }, [dlResultData?.train_loss])

  const dlValidData = useMemo(() => {
    return {
      label: 'Valid lLoss',
      data: dlResultData?.valid_loss?.map(item => {
        return item
      }),

      backgroundColor: 'rgba(255, 166, 77, 1)',
      order: 2,
      pointRadius: 1,
      borderColor: 'rgba(255, 166, 77, 1)',
    }
  }, [dlResultData?.valid_loss])

  const trainChartDataSet = useMemo(() => {
    return {
      datasets: [dlTrainData, dlValidData],
      labels: dlResultData?.valid_loss.map((_, i) => i),
    }
  }, [dlTrainData, dlValidData])

  //DL-MSE Second Data
  const dlMseData = useMemo(() => {
    return {
      label: 'mse',

      data: dlResultData?.mse?.map(item => {
        return item
      }),
      type: 'line',
      backgroundColor: 'rgba(45, 199, 232, 1)',
      borderColor: 'rgba(45, 199, 232, 1)',
      pointRadius: 1,

      order: 2,
    }
  }, [dlResultData?.train_loss])

  const dlThreshold = useMemo(() => {
    return {
      label: 'DL_threshold',
      type: 'line',
      borderColor: 'red',
      data: dlResultData?.mse.map(() => dlResultData?.dl_threshold),
      borderWidth: 1,
      pointRadius: 1,
      order: 1,
    }
  }, [dlResultData?.dl_threshold, dlResultData?.mse?.length])

  const mseChartDataSet = useMemo(() => {
    return {
      datasets: [dlMseData, dlThreshold],
      labels: dlResultData?.mse?.map((_, i) => i),
    }
  }, [dlMseData, dlThreshold.data, dlResultData])

  const options = {
    scales: {
      x: {
        grid: {
          display: true,
          drawTicks: 1,
          color: '#383846',
        },
      },
      y: {
        // min: 0,
        // max: 1,
        beginAtZero: true,
        grid: {
          display: true,
          drawTicks: 1,
          color: '#383846',
        },
      },
    },
    // animations: false,
    // animation: {duration: 0},
    // intersect: false,
    hover: {intersect: false},
    plugins: {
      tooltip: {enabled: false},
    },
  }

  return (
    <>
      <DLNxRstChart
        isNoData={noData}
        loading={loading}
        dlResultData={dlResultData}
        trainChartDataSet={trainChartDataSet}
        mseChartDataSet={mseChartDataSet}
        options={options}
      />
    </>
  )
}

export default PredictionModalDLChart
