// libraries
import _ from 'lodash'
import React, {PureComponent} from 'react'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

// component
import OpenStackPageInstanceDetailSection from 'src/clouds/components/OpenStackPageInstanceDetailSection'
import OpenStackPageHeader from 'src/clouds/components/OpenStackPageHeader'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// types
import {FocusedInstance, OpenStackInstance} from 'src/clouds/types/openstack'

interface Props {
  selectInstanceData: OpenStackInstance['detail']
  focusedInstance: Partial<FocusedInstance>
  instanceTypeModal?: () => void
}

class OpenStackPageInstanceDetail extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }
  private get InstanceDetailContetns(): JSX.Element {
    const {selectInstanceData} = this.props

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
  public render() {
    const {focusedInstance} = this.props

    return (
      <>
        <OpenStackPageHeader
          cellName={`Limit Summary (${focusedInstance.instanceName || ''})`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        />
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
      </>
    )
  }
}

export default OpenStackPageInstanceDetail
