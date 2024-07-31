import React, {useEffect, useMemo, useState} from 'react'
import {Scatter} from 'react-chartjs-2'
import {GetLearningMLData} from 'src/types'
import {getLearningRstMl} from '../apis'
import _ from 'lodash'

interface Props {
  host: string
}
function PredictionModalMLChart({host}: Props) {
  const [mlResultData, setMlResultData] = useState<GetLearningMLData>()

  const [noData, setNoData] = useState(false)

  const [loading, setLoading] = useState(true)

  const [gaussianMin, setGaussianMin] = useState(0)

  const [gaussianMax, setGaussianMax] = useState(20)

  useEffect(() => {
    getMlData(host)

    return () => {
      setMlResultData(null)
      setNoData(true)
      setLoading(true)
    }
  }, [host])

  const getMlData = async (host: string) => {
    try {
      const result = await getLearningRstMl(host)
      if (!result) {
        setNoData(true)
      } else {
        setMlResultData(result.data)
        setGaussianMax(
          findMinMaxValue(
            _.max(result.data.cpu_array),
            _.max(result.data.traffic_array),
            'max'
          )
        )

        setGaussianMin(
          findMinMaxValue(
            _.min(result.data.cpu_array),
            _.min(result.data.traffic_array),
            'min'
          )
        )
        setNoData(false)
      }
    } catch (e) {
      console.error(e)
    }

    setLoading(false)
  }

  const findMinMaxValue = (a: number, b: number, type: 'min' | 'max') => {
    let result
    if (a > b) {
      result = type === 'max' ? a : b
    } else {
      result = type === 'max' ? b : a
    }

    return type === 'max' ? Math.ceil(result) : Math.floor(result)
  }
  //ML first chart
  const mlMdData = useMemo(() => {
    return {
      label: 'MD',
      data: mlResultData?.md_array?.map((item, idx) => {
        return {
          x: idx,
          y: item,
        }
      }),
      backgroundColor: 'rgba(45, 199, 232, 1)',
      order: 2,
      pointRadius: 2,
    }
  }, [mlResultData])

  const mlThreshold = useMemo(() => {
    return {
      label: 'MD threshold',
      type: 'line',
      borderColor: 'red',
      data: [
        {x: 0, y: mlResultData?.md_threshold}, // threshold 값
        {x: mlResultData?.md_array?.length, y: mlResultData?.md_threshold},
      ],
      order: 1,
    }
  }, [mlResultData?.md_threshold, mlResultData?.md_array?.length])

  const mlChartDataSet = useMemo(() => {
    return {
      datasets: [mlMdData, mlThreshold],
    }
  }, [mlMdData])

  //second chart
  const mlCpuData = useMemo(() => {
    return {
      label: 'CPU',
      data: mlResultData?.cpu_array?.map((item, idx) => {
        return {
          x: item,
          y: mlResultData?.gaussian_array[idx],
        }
      }),

      backgroundColor: 'rgba(45, 199, 232, 1)',
      order: 2,
      pointRadius: 2,
    }
  }, [mlResultData?.cpu_array])

  const mlTrafficData = useMemo(() => {
    return {
      label: 'Traffic',
      data: mlResultData?.traffic_array?.map((item, idx) => {
        return {
          x: item,
          y: mlResultData?.gaussian_array[idx],
        }
      }),

      backgroundColor: 'rgba(255, 166, 77, 1)',
      order: 2,
      pointRadius: 2,
    }
  }, [mlResultData?.traffic_array])

  const mlEpsilon = useMemo(() => {
    return {
      label: 'eps',
      type: 'line',
      borderColor: 'red',
      data: [
        {x: gaussianMin, y: mlResultData?.epsilon}, // threshold 값
        {x: gaussianMax, y: mlResultData?.epsilon}, // threshold 값
      ],
      order: 1,
    }
  }, [
    mlResultData?.epsilon,
    mlResultData?.traffic_array?.length,
    gaussianMin,
    gaussianMax,
  ])

  const gaussianChartDataSet = useMemo(() => {
    return {
      // can get Legend
      datasets: [mlCpuData, mlTrafficData, mlEpsilon],
    }
  }, [mlCpuData, mlTrafficData, mlEpsilon])

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
      {noData ? (
        <div className="generic-empty-state">
          <h4 style={{margin: '90px 0'}}>No Data. </h4>
        </div>
      ) : loading ? (
        <></>
      ) : (
        <div className="chartSector">
          <div>
            <span style={{whiteSpace: 'pre-wrap'}} className="span-header">
              {`eps:\n${mlResultData?.epsilon ?? ''}`}
            </span>
            <br />
            <span style={{whiteSpace: 'pre-wrap'}} className="span-header">
              {`mean:\n${mlResultData?.mean_matrix ?? ''}`}
            </span>
            <br />
            <span style={{whiteSpace: 'pre-wrap'}} className="span-header ">
              {`cov:\n[${JSON.parse(`${mlResultData?.covariance_matrix}`)
                .map(innerArray => `[${innerArray.join(', ')}]`)
                .join(', \n')}]`}
            </span>
          </div>
          <div className="prediction-chart-wrap">
            <Scatter
              //@ts-ignore
              data={mlChartDataSet}
              //@ts-ignore
              options={options}
              width={500}
              height={300}
            />
          </div>
          <div className="prediction-chart-wrap">
            <Scatter
              //@ts-ignore
              data={gaussianChartDataSet}
              //@ts-ignore
              options={options}
              width={500}
              height={300}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default PredictionModalMLChart
