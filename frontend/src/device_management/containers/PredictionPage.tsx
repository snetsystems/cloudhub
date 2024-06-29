import {ChartDataset} from 'chart.js'
import React, {useMemo, useState} from 'react'
import {connect} from 'react-redux'
import {PredictionModal} from '../components/PredictionModal'
import HexagonComponent from 'src/chart_test/containers/Hexbin'
import PredictionDashBoard from '../components/PredictionDashBoard'
import {Source, TimeRange} from 'src/types'

interface Props {
  timeRange: TimeRange
  source: Source
}
function PredictionPage({timeRange, source}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const [dataCount, setDataCount] = React.useState(100)

  const [threshold, setThreshold] = React.useState(10)

  const [chartDate, setChartData] = useState<ChartDataset>()

  const dummy = React.useMemo<ChartDataset>(() => {
    return {
      label: 'A dataset',
      data: Array.from({length: dataCount}, (_, i) => ({
        x: i,
        y: Math.random() * 100,
      })),
      backgroundColor: 'rgba(45, 199, 232, 1)',
      order: 2,
    }
  }, [dataCount])

  const dummy2 = React.useMemo<ChartDataset>(() => {
    return {
      label: 'A dataset',
      data: Array.from({length: dataCount}, (_, i) => ({
        x: i,
        y: Math.random() * 100,
      })),
      backgroundColor: 'rgba(45, 199, 232, 1)',
      order: 2,
    }
  }, [dataCount])

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

  const data = useMemo(() => {
    return {
      // can get Legend
      datasets: [chartDate, thresholdDummy],
    }
  }, [chartDate])

  return (
    <>
      <PredictionDashBoard
        source={source}
        timeRange={timeRange}
        inPresentationMode={true}
      />
      {/* <div className="panel panel-solid">
        <div className="panel-heading"></div>
        <div className="panel-body"></div>
        <div className="panel-body">
          <button
            onClick={() => {
              setIsOpen(true)
              setChartData(dummy)
            }}
          >
            prediction
          </button>

          <button
            onClick={() => {
              setIsOpen(true)
              setChartData(dummy2)
            }}
          >
            prediction
          </button>
          <input
            type="number"
            onChange={e => {
              setDataCount(Number(e.target.value))
              // setTempVar(e.target.value)
            }}
            value={dataCount}
          />
          <input
            type="number"
            onChange={e => setThreshold(Number(e.target.value))}
            value={threshold}
          />
        </div>
      </div>
      <PredictionModal
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        data={data}
        options={options}
      /> */}
    </>
  )
}

export default connect(null)(PredictionPage)
// export default AiSettingPage
