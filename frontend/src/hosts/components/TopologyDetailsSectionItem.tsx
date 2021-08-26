import React, {PureComponent} from 'react'
import {AWSInstanceData} from 'src/hosts/types/cloud'

interface Props {
  label: string
  contents: AWSInstanceData['info']
}

interface State {}

class TopologyDetailsSectionItem extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {label, contents} = this.props

    return (
      <div className={'section-item'}>
        <div className={'util-label'}>{label}</div>
        <div className={'section-item-contents'}>{contents}</div>
      </div>
    )
  }
}

export default TopologyDetailsSectionItem
