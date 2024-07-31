import React from 'react'
import {Scatter} from 'react-chartjs-2'
import {MLChartSectorProps, ContentItem} from 'src/types/prediction'
import ModalContentHeader from 'src/device_management/components/PredictionModalContentHeader'
import {NoData} from './PredictionModalNodata'

export const MLNxRstChart: React.FC<MLChartSectorProps> = ({
  isNoData,
  loading,
  mlResultData,
  mlChartDataSet,
  gaussianChartDataSet,
  options,
}) => {
  if (isNoData) {
    return <NoData />
  }
  if (loading) {
    return <div>isLoading</div>
  }
  const headerContents: ContentItem[] = [
    {title: 'eps', content: mlResultData?.epsilon ?? ''},
    {title: 'mean', content: mlResultData?.mean_matrix ?? ''},
    {
      title: 'cov',
      content: JSON.parse(`${mlResultData?.covariance_matrix || '[]'}`),
    },
  ]

  return (
    <div className="chartSector">
      <div>
        <ModalContentHeader headerContents={headerContents} />
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
}
