// Library
import _ from 'lodash'
import React, {PureComponent} from 'react'

// Component
import TopologyDetailsSection from 'src/hosts/components/TopologyDetailsSection'

// Types
import {AWSInstanceData} from 'src/hosts/types/cloud'
import {HostDetailTable} from 'src/hosts/types/agent'

interface Props {
  selectInstanceData: AWSInstanceData['instanceID'] | HostDetailTable
  instanceTypeModal?: () => void
}

class TopologyDetails extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {selectInstanceData, instanceTypeModal} = this.props

    if (_.isEmpty(selectInstanceData)) {
      return (
        <div
          className={'tab-pannel'}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            fontSize: '18px',
          }}
        >
          <div>No Data</div>
        </div>
      )
    }

    return (
      <div className={'tab-pannel'}>
        {_.map(_.keys(selectInstanceData), d => {
          return (
            <TopologyDetailsSection
              key={d}
              title={d.replaceAll('_', ' ')}
              selectInstanceData={selectInstanceData[d]}
              instanceTypeModal={instanceTypeModal}
            />
          )
        })}
      </div>
    )
  }
}

export default TopologyDetails
