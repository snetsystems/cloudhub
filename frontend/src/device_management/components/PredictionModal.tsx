import React, {useMemo, useState} from 'react'
import {Scatter} from 'react-chartjs-2'
import {Form} from 'src/reusable_ui'
import {ChartDataset} from 'chart.js'

interface Props {
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  index: number
}

// SVG Hexbin on/off split
export const PredictionModal = ({isOpen, setIsOpen, index}: Props) => {
  const [dataCount, setDataCount] = useState(500)

  const [threshold, setThreshold] = useState(130)

  const [chartDate, setChartData] = useState<ChartDataset>()

  const randomOverValue = () => {
    return threshold + Math.random() * 30
  }

  const fixedToNumber = (num: number) => {
    return Number(num.toFixed(0))
  }

  const dummy = React.useMemo<ChartDataset>(() => {
    const targetX = [...Array(fixedToNumber(Math.sqrt(index * 2)))].map(_ => {
      return fixedToNumber(Math.random() * dataCount)
    })
    return {
      label: 'A dataset',
      data: Array.from({length: dataCount}, (_, i) => {
        if (targetX.includes(i)) {
          return {
            x: i,
            y: randomOverValue(),
          }
        }
        return {
          x: i,
          y: Math.random() * 100,
        }
      }),

      backgroundColor: 'rgba(45, 199, 232, 1)',
      order: 2,
    }
  }, [dataCount, index])

  const dummy2 = React.useMemo<ChartDataset>(() => {
    const targetX = [...Array(5)].map(_ => {
      return fixedToNumber(Math.random() * dataCount)
    })
    return {
      label: 'B dataset',
      data: Array.from({length: dataCount}, (_, i) => {
        if (targetX.includes(i)) {
          return {
            x: i,
            y: randomOverValue(),
          }
        }
        return {
          x: i,
          y: Math.random() * 100,
        }
      }),
      backgroundColor: 'rgba(45, 199, 232, 1)',
      order: 2,
    }
  }, [dataCount, index])

  const thresholdDummy = useMemo<ChartDataset>(() => {
    return {
      label: 'Threshold',
      type: 'line',
      borderColor: 'red',
      data: [
        {x: 0, y: threshold}, // threshold 값
        {x: dataCount, y: threshold}, // threshold 값
      ],
      order: 1,
    }
  }, [threshold, dataCount])

  const options = {
    scales: {
      y: {
        beginAtZero: true,
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

  const upData = useMemo(() => {
    return {
      // can get Legend
      datasets: [dummy, thresholdDummy],
    }
  }, [dummy, index])

  const downData = useMemo(() => {
    return {
      // can get Legend
      datasets: [dummy2, thresholdDummy],
    }
  }, [dummy2, index])

  return (
    <div className={`prediction-form ${isOpen ? 'open' : 'close'}`}>
      <div className={'overlay--heading'}>
        <div className="overlay--title">{'Prediction'}</div>
        <button className="overlay--dismiss" onClick={() => setIsOpen(false)}>
          close
        </button>
      </div>

      <div className="overlay--body">
        <Form>
          <Form.Element>
            {isOpen && (
              <>
                <div className="prediction-chart-wrap">
                  <Scatter
                    //@ts-ignore
                    data={upData}
                    options={options}
                    width={500}
                    height={300}
                  />
                </div>
                <div className="prediction-chart-wrap">
                  <Scatter
                    //@ts-ignore
                    data={downData}
                    options={options}
                    width={500}
                    height={300}
                  />
                </div>
              </>
            )}
          </Form.Element>
          <Form.Footer>
            <div></div>
          </Form.Footer>
        </Form>
      </div>
    </div>
  )
}
