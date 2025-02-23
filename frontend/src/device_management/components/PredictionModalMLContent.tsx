import React, {useContext} from 'react'

// Library
import {Scatter} from 'react-chartjs-2'

// Components
import PageSpinner from 'src/shared/components/PageSpinner'
import {NoData} from 'src/device_management/components/PredictionModalNodata'
import ModalContentHeader from 'src/device_management/components/PredictionModalContentHeader'

// Type
import {MLChartSectorProps, ContentItem} from 'src/types/prediction'

//constant
import {ModalSizeContext} from 'src/device_management/constants/prediction'

const ChartWrapper: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {height} = useContext(ModalSizeContext)

  return (
    <div
      style={{width: '500px', height: height}}
      className="prediction-chart-wrap"
    >
      {children}
    </div>
  )
}

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
  mlChartDataSet: any,
  gaussianChartDataSet: any,
  options: any
) => {
  const {height} = useContext(ModalSizeContext)

  return (
    <div className="chartSector">
      <ChartWrapper>
        <Scatter
          //@ts-ignore
          data={mlChartDataSet}
          //@ts-ignore
          options={options}
          width={500}
          height={height}
        />
      </ChartWrapper>
      <ChartWrapper>
        <Scatter
          //@ts-ignore
          data={gaussianChartDataSet}
          //@ts-ignore
          options={options}
          width={500}
          height={height}
        />
      </ChartWrapper>
    </div>
  )
}

export const MLNxRstChart: React.FC<MLChartSectorProps> = ({
  isNoData,
  loading,
  mlResultData,
  mlChartDataSet,
  gaussianChartDataSet,
  options,
}) => {
  const headerContents: ContentItem[] = mlResultData
    ? [
        {title: 'eps', content: mlResultData.epsilon ?? ''},
        {title: 'mean', content: mlResultData.mean_matrix ?? ''},
        {
          title: 'cov',
          content: `[${JSON.parse(`${mlResultData.covariance_matrix || '[]'}`)
            .map((innerArray: any[]) => `[${innerArray.join(', ')}]`)
            .join(', \n')}]`,
        },
      ]
    : []

  const getInnerComponents = () => {
    if (loading) {
      return getLoadingComponent()
    }
    if (isNoData) {
      return getNoDataComponent()
    }
    return getChartComponents(mlChartDataSet, gaussianChartDataSet, options)
  }

  return (
    <div className="chartSector">
      <div>
        <ModalContentHeader
          title="ML Plot"
          headerContents={isNoData ? [] : headerContents}
        />
      </div>
      {getInnerComponents()}
    </div>
  )
}
