// libraries
import React from 'react'
import {PureComponent} from 'react'

// components
import {ErrorHandling} from 'src/shared/decorators/errors'
import OpenStackPageInstanceDetail from 'src/clouds/components/OpenStackPageInstanceDetail'

// types
import {FocusedInstance, OpenStackInstance} from 'src/clouds/types/openstack'

export interface Props {
  focusedInstanceData: Partial<OpenStackInstance>
  focusedInstance: Partial<FocusedInstance>
}

@ErrorHandling
class OpenStackPageInstanceOverview extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }
  public render() {
    const {focusedInstanceData, focusedInstance} = this.props
    const selectInstanceData = focusedInstance
      ? focusedInstanceData?.detail
      : ({} as OpenStackInstance['detail'])

    return (
      <div style={{height: '100%', backgroundColor: '#292933'}}>
        <OpenStackPageInstanceDetail
          focusedInstance={focusedInstance}
          selectInstanceData={selectInstanceData}
        />

        <div className="dash-graph--gradient-border">
          <div className="dash-graph--gradient-top-left" />
          <div className="dash-graph--gradient-top-right" />
          <div className="dash-graph--gradient-bottom-left" />
          <div className="dash-graph--gradient-bottom-right" />
        </div>
      </div>
    )
  }
}
export default OpenStackPageInstanceOverview
