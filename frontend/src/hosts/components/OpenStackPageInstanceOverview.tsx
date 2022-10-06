// libraries
import React from 'react'
import {PureComponent} from 'react'

// components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {ErrorHandling} from 'src/shared/decorators/errors'
import OpenStackPageInstanceDetail from 'src/hosts/components/OpenStackPageInstanceDetail'

// types
import {OpenStackInstance} from 'src/hosts/types/openstack'

export interface Props {
  focusedInstance: Partial<OpenStackInstance>
}

@ErrorHandling
class OpenStackPageInstanceOverview extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }
  public render() {
    const {focusedInstance} = this.props
    const selectInstanceData = focusedInstance
      ? focusedInstance?.detail
      : ({} as OpenStackInstance['detail'])

    return (
      <div style={{height: '100%', backgroundColor: '#292933'}}>
        <FancyScrollbar autoHide={true}>
          <OpenStackPageInstanceDetail
            selectInstanceData={selectInstanceData}
          />
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
}
export default OpenStackPageInstanceOverview
