import React, {PureComponent} from 'react'
import {AWSInstanceData} from 'src/hosts/types/cloud'

interface Props {
  label: string
  contents: AWSInstanceData['info']
  instanceTypeModal?: () => void
}

interface State {}

class TopologyDetailsSectionItem extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {label} = this.props

    return (
      <div className={'section-item'}>
        <div className={'util-label'}>{label}</div>
        {this.renderContents}
      </div>
    )
  }

  private get renderContents() {
    const {label, contents, instanceTypeModal} = this.props

    if (label === 'Instance type') {
      if (instanceTypeModal) {
        return (
          <div
            className={'section-item-contents handler'}
            onClick={instanceTypeModal}
          >
            {contents}
          </div>
        )
      }
    }
    return <div className={'section-item-contents'}>{contents}</div>
  }
}

export default TopologyDetailsSectionItem
