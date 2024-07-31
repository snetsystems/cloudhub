import React from 'react'
import {Line, Scatter} from 'react-chartjs-2'
import {DLChartSectorProps, ContentItem} from 'src/types/prediction'
import ModalContentHeader from 'src/device_management/components/PredictionModalContentHeader'
import {NoData} from './PredictionModalNodata'
import PageSpinner from 'src/shared/components/PageSpinner'

const ChartWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{width: '500px', height: '300px'}}
    className="prediction-chart-wrap"
  >
    {children}
  </div>
)

const getLoadingComponent = () => (
  <div className="chartSector">
    <ChartWrapper>
      <PageSpinner />
    </ChartWrapper>
    <ChartWrapper>
      <PageSpinner />
    </ChartWrapper>
  </div>
)

const getNoDataComponent = () => (
  <div className="chartSector">
    <ChartWrapper>
      <NoData />
    </ChartWrapper>
    <ChartWrapper>
      <NoData />
    </ChartWrapper>
  </div>
)

const getChartComponents = (
  trainChartDataSet: any,
  mseChartDataSet: any,
  options: any
) => (
  <div className="chartSector">
    <ChartWrapper>
      <Line
        //@ts-ignore
        data={trainChartDataSet}
        //@ts-ignore
        options={{
          ...options,
          scales: {
            ...options.scales,
            x: {...options.scales.x, type: 'linear', min: -10},
          },
        }}
        width={500}
        height={300}
      />
    </ChartWrapper>
    <ChartWrapper>
      <Scatter
        //@ts-ignore
        data={mseChartDataSet}
        //@ts-ignore
        options={options}
        width={500}
        height={300}
      />
    </ChartWrapper>
  </div>
)

export const DLNxRstChart: React.FC<DLChartSectorProps> = ({
  isNoData,
  loading,
  dlResultData,
  trainChartDataSet,
  mseChartDataSet,
  options,
}) => {
  const headerContents: ContentItem[] = dlResultData
    ? [{title: 'dl_threshold', content: dlResultData.dl_threshold ?? ''}]
    : []

  const getInnerComponents = () => {
    if (loading) {
      return getLoadingComponent()
    }
    if (isNoData) {
      return getNoDataComponent()
    }
    return getChartComponents(trainChartDataSet, mseChartDataSet, options)
  }

  return (
    <div className="chartSector">
      <div>
        <ModalContentHeader
          title="DL Curve & Mean Squared Error"
          headerContents={isNoData ? [] : headerContents}
        />
      </div>
      {getInnerComponents()}
    </div>
  )
}
