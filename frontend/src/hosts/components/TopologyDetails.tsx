import _ from 'lodash'
import React, {PureComponent} from 'react'
import TopologyDetailsSection from 'src/hosts/components/TopologyDetailsSection'

// component
import {AWSInstanceData} from 'src/hosts/types/cloud'

interface Props {
  selectInstanceData: AWSInstanceData['instanceID']
}

interface State {}

class TopologyDetails extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {selectInstanceData} = this.props

    return (
      <div className={'tab-pannel'}>
        {_.map(_.keys(selectInstanceData), d => {
          return (
            <TopologyDetailsSection
              key={d}
              title={d.replaceAll('_', ' ')}
              selectInstanceData={selectInstanceData[d]}
            />
          )
        })}
      </div>
    )
  }
}

export default TopologyDetails