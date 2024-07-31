import React, {useEffect, useMemo, useState} from 'react'
import {Line, Scatter} from 'react-chartjs-2'
import {Form} from 'src/reusable_ui'
import {GetLearningDLData, GetLearningMLData} from 'src/types'
import {getLearningRstDL, getLearningRstMl} from '../apis'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import _ from 'lodash'

interface Props {
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  isMl: boolean
  isDl: boolean
  host: string
}

// SVG Hexbin on/off split
export const PredictionModal = ({
  isOpen,
  setIsOpen,
  isMl,
  isDl,
  host,
}: Props) => {
  const [loading, setLoading] = useState(true)

  const [mlResultData, setMlResultData] = useState<GetLearningMLData>()

  const [dlResultData, setDlResultData] = useState<GetLearningDLData>()

  const [gaussianMin, setGaussianMin] = useState(0)

  const [gaussianMax, setGaussianMax] = useState(20)

  const [error, setError] = useState<unknown>('')

  const [noData, setNoData] = useState(false)
  useEffect(() => {
    try {
      isMl && getMlData(host)
      isDl && getDlData(host)
    } catch (e) {
      setLoading(false)
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
      }
    } catch (e) {
      console.log(e)
    }

    setLoading(false)
  }

  const getDlData = async (host: string) => {
    try {
      const result = await getLearningRstDL(host)
      if (!result) {
        setNoData(true)
      } else {
        setDlResultData(result.data)
      }
    } catch (e) {
      console.log(e)
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

      backgroundColor: 'rgba(45, 199, 232, 1)',
      order: 2,
    }
  }, [dlResultData?.train_loss])

  const dlThreshold = useMemo(() => {
    console.log(dlResultData?.mse?.length)
    return {
      label: 'DL_threshold',
      type: 'line',
      borderColor: 'red',
      data: [
        {x: 0, y: dlResultData?.dl_threshold}, // threshold 값
        {x: dlResultData?.mse?.length, y: dlResultData?.dl_threshold},
      ],
      order: 1,
    }
  }, [dlResultData?.dl_threshold, dlResultData?.mse?.length])

  const mseChartDataSet = useMemo(() => {
    console.log(dlThreshold)

    return {
      datasets: [dlMseData, dlThreshold],
      labels: dlResultData?.mse?.map((_, i) => i),
    }
  }, [dlMseData, dlThreshold])

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
    <div className={`prediction-form ${isOpen ? 'open' : 'close'}`}>
      <FancyScrollbar autoHeight={true} maxHeight={800} autoHide={false}>
        <div className={'overlay--heading'}>
          <div className="overlay--title">{'Prediction'}</div>
          <button className="overlay--dismiss" onClick={() => setIsOpen(false)}>
            close
          </button>
        </div>

        <div className="overlay--body">
          {loading ? (
            <></>
          ) : !!error ? (
            <>
              {!!error && (
                <div className="generic-empty-state">
                  <h4 style={{margin: '90px 0'}}>Error: {error}</h4>
                </div>
              )}
              {!(mlResultData && isMl) && !(dlResultData && isDl) && (
                <div className="generic-empty-state">
                  <h4 style={{margin: '90px 0'}}>No Data. </h4>
                </div>
              )}
            </>
          ) : (
            <Form>
              <Form.Element>
                {
                  <>
                    {noData && isMl ? (
                      <div className="generic-empty-state">
                        <h4 style={{margin: '90px 0'}}>No Data. </h4>
                      </div>
                    ) : (
                      isMl && (
                        <div className="chartSector">
                          <div>
                            <span
                              style={{whiteSpace: 'pre-wrap'}}
                              className="span-header"
                            >
                              {`eps:\n${mlResultData?.epsilon ?? ''}`}
                            </span>
                            <br />
                            <span
                              style={{whiteSpace: 'pre-wrap'}}
                              className="span-header"
                            >
                              {`mean:\n${mlResultData?.mean_matrix ?? ''}`}
                            </span>
                            <br />
                            <span
                              style={{whiteSpace: 'pre-wrap'}}
                              className="span-header "
                            >
                              {`cov:\n[${JSON.parse(
                                `${mlResultData?.covariance_matrix}`
                              )
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
                      )
                    )}

                    {noData && isDl ? (
                      <div className="generic-empty-state">
                        <h4 style={{margin: '90px 0'}}>No Data. </h4>
                      </div>
                    ) : (
                      isDl && (
                        <div className="chartSector">
                          <div>
                            <span
                              style={{whiteSpace: 'pre-wrap'}}
                              className="span-header"
                            >
                              {`dl_threshold: \n${
                                dlResultData?.dl_threshold ?? ''
                              }`}
                            </span>
                          </div>
                          <div className="prediction-chart-wrap">
                            <Line
                              //@ts-ignore
                              data={trainChartDataSet}
                              //@ts-ignore
                              options={options}
                              width={500}
                              height={300}
                            />
                          </div>
                          <div className="prediction-chart-wrap">
                            <Line
                              //@ts-ignore
                              data={mseChartDataSet}
                              //@ts-ignore
                              options={options}
                              width={500}
                              height={300}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </>
                }
              </Form.Element>
              <Form.Footer>
                <div></div>
              </Form.Footer>
            </Form>
          )}
        </div>
      </FancyScrollbar>
    </div>
  )
}
