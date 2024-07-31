import React from 'react'
import {Line} from 'react-chartjs-2'
import {DLChartSectorProps, ContentItem} from 'src/types/prediction'
import ModalContentHeader from 'src/device_management/components/PredictionModalContentHeader'
import {NoData} from './PredictionModalNodata'

export const DLNxRstChart: React.FC<DLChartSectorProps> = ({
  isNoData,
  loading,
  dlResultData,
  trainChartDataSet,
  mseChartDataSet,
  options,
}) => {
  if (isNoData) {
    return <NoData />
  }
  if (loading) {
    return null
  }

  const headerContents: ContentItem[] = [
    {title: 'dl_threshold', content: dlResultData?.dl_threshold ?? ''},
  ]

  return (
    <div className="chartSector">
      <div>
        <ModalContentHeader headerContents={headerContents} />
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
}
