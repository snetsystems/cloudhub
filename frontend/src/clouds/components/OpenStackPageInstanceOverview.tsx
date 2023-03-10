// libraries
import React from 'react'
import {PureComponent} from 'react'
import _ from 'lodash'

// components
import {ErrorHandling} from 'src/shared/decorators/errors'
import LoadingDots from 'src/shared/components/LoadingDots'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import OpenStackPageInstanceDetailSection from 'src/clouds/components/OpenStackPageInstanceDetailSection'
import OpenStackPageHeader from 'src/clouds/components/OpenStackPageHeader'

// types
import {FocusedInstance, OpenStackInstance} from 'src/clouds/types/openstack'
import {RemoteDataState} from 'src/types'

// constants
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

export interface Props {
  focusedInstanceData: Partial<OpenStackInstance>
  focusedInstance: Partial<FocusedInstance>
  saltRemoteDataState: RemoteDataState
}

@ErrorHandling
class OpenStackPageInstanceOverview extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }
  public render() {
    const {focusedInstance, saltRemoteDataState} = this.props

    return (
      <div style={{height: '100%', backgroundColor: '#292933'}}>
        <OpenStackPageHeader
          cellName={`Details (${focusedInstance.instanceName || ''})`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          {saltRemoteDataState === RemoteDataState.Loading && (
            <LoadingDots
              className={'graph-panel__refreshing openstack-dots--loading'}
            />
          )}
        </OpenStackPageHeader>
        <FancyScrollbar style={{height: 'calc(100% - 45px)'}} autoHide={true}>
          <div
            style={{
              backgroundColor: DEFAULT_CELL_BG_COLOR,
              height: 'calc(100% - 45px)',
            }}
            className={'tab-pannel'}
          >
            {this.InstanceDetailContetns}
          </div>
        </FancyScrollbar>

        <div className="dash-graph--gradient-border">
          <div className="dash-graph--gradient-top-left" />
          <div className="dash-graph--gradient-top-right" />
          <div className="dash-graph--gradient-bottom-left" />
          <div className="dash-graph--gradient-bottom-right" />
        </div>
      </div>
    )
  }

  private get InstanceDetailContetns(): JSX.Element {
    const {focusedInstance, focusedInstanceData} = this.props

    const selectInstanceData = focusedInstance
      ? focusedInstanceData?.detail
      : ({} as OpenStackInstance['detail'])
    if (_.isEmpty(selectInstanceData)) {
      return (
        <div className="generic-empty-state">
          <h4 style={{margin: '90px 0'}}>No Instances found</h4>
        </div>
      )
    }
    return (
      <>
        {_.map(_.keys(selectInstanceData), d => {
          return (
            <OpenStackPageInstanceDetailSection
              key={d}
              title={d.replaceAll('_', ' ')}
              selectInstanceData={selectInstanceData[d]}
            />
          )
        })}
      </>
    )
  }
}
export default OpenStackPageInstanceOverview
