// library
import _ from 'lodash'
import React, {Fragment, PureComponent} from 'react'

// component
import OpenStackProjectGaugeChart from 'src/hosts/components/OpenStackProjectGaugeChart'
import PageSpinner from 'src/shared/components/PageSpinner'
import OpenStackPageHeader from 'src/hosts/components//OpenStackPageHeader'

// types
import {RemoteDataState} from 'src/types'
import {
  OpenStackGaugeChartProjectData,
  OpenStackGaugeChartSize,
} from 'src/hosts/types/'

// constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

interface Props {
  gaugeChartState: RemoteDataState
  projectName: string
  projectData: OpenStackGaugeChartProjectData
  maxInstanceCount?: number
}

export default class OpenStackProjectGaugeChartLayout extends PureComponent<Props> {
  public static defaultProps: Partial<Props> = {
    maxInstanceCount: 6,
    projectData: {},
  }
  constructor(props: Props) {
    super(props)
  }

  private get gaugeChartSize(): OpenStackGaugeChartSize {
    const {maxInstanceCount} = this.props
    const proportions = (100 / maxInstanceCount).toString() + '%'

    return {
      width: proportions,
      height: '100%',
    }
  }

  private get CloudGaugeContents(): JSX.Element {
    const {projectData, gaugeChartState} = this.props
    const cloudService = Object.keys(projectData)

    if (
      gaugeChartState === RemoteDataState.Loading ||
      gaugeChartState === RemoteDataState.NotStarted
    ) {
      return this.LoadingState
    }

    if (gaugeChartState === RemoteDataState.Error) {
      return this.ErrorState
    }

    if (_.isEmpty(projectData)) {
      return this.NoProjectState
    }

    return (
      <>
        {cloudService.map(cloudService => {
          const cloudResources = projectData[cloudService]

          return (
            <div className="gauge-wrap" key={cloudService}>
              {cloudResources.map((cloudResource, index) => {
                const gaugeTitle = index === 0 ? cloudService : ''
                const resourceName = cloudResource?.resourceName
                const gaugePosition = cloudResource?.gaugePosition
                const resourceUsuage = cloudResource?.resourceUsuage

                return (
                  <Fragment key={resourceName}>
                    <OpenStackProjectGaugeChart
                      gaugeTitle={gaugeTitle}
                      gaugeName={resourceName}
                      gaugePosition={gaugePosition}
                      gaugeChartSize={this.gaugeChartSize}
                      resourceUsuage={resourceUsuage}
                    />
                  </Fragment>
                )
              })}
            </div>
          )
        })}
      </>
    )
  }

  private get NoProjectState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>No Project found</h4>
      </div>
    )
  }

  private get LoadingState(): JSX.Element {
    return <PageSpinner />
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>
          There was a problem loading Gauge Chart
        </h4>
      </div>
    )
  }

  public render() {
    const {projectName} = this.props

    return (
      <>
        <OpenStackPageHeader
          cellName={`Limit Summary (${projectName})`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        />
        <div style={{height: 'calc(100% - 40px)'}} className="panel-body">
          {this.CloudGaugeContents}
        </div>
        <div className="dash-graph--gradient-border">
          <div className="dash-graph--gradient-top-left" />
          <div className="dash-graph--gradient-top-right" />
          <div className="dash-graph--gradient-bottom-left" />
          <div className="dash-graph--gradient-bottom-right" />
        </div>
      </>
    )
  }
}
