// libraries
import _ from 'lodash'
import React, {PureComponent} from 'react'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

// component
import OpenStackPageInstanceDetailSection from 'src/hosts/components/OpenStackPageInstanceDetailSection'
import OpenStackPageHeader from 'src/hosts/components/OpenStackPageHeader'

// types
import {OpenStackInstance} from 'src/hosts/types/openstack'

interface Props {
  selectInstanceData: OpenStackInstance['detail']
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
    const {selectInstanceData} = this.props
    const selectedInstanceName = !_.isEmpty(selectInstanceData)
      ? selectInstanceData.overview.name
      : ''

    return (
      <>
        <OpenStackPageHeader
          cellName={`Limit Summary (${selectedInstanceName})`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        />
        <div
          style={{backgroundColor: DEFAULT_CELL_BG_COLOR}}
          className={'tab-pannel'}
        >
          {this.InstanceDetailContetns}
        </div>
      </>
    )
  }
}

export default OpenStackPageInstanceDetail
