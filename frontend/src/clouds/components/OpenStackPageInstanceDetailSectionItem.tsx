// libraries
import React, {PureComponent} from 'react'

interface Props {
  label: string
  contents: {
    [instanceID: string]: {[info: string]: number | string | JSX.Element}
  }
}

interface State {}

class OpenStackPageInstanceDetailSectionItem extends PureComponent<
  Props,
  State
> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {label} = this.props

    return (
      <div
        className={'section-item'}
        style={{flex: 1, width: '100%', maxWidth: '100%', flexDirection: 'row'}}
      >
        <div
          className={'util-label'}
          style={{flex: 1, textAlign: 'right', paddingRight: '20px'}}
        >
          {label}
        </div>
        {this.renderContents}
      </div>
    )
  }

  private get renderContents() {
    const {contents} = this.props

    return (
      <div
        className={'section-item-contents'}
        style={{flex: 3, whiteSpace: 'pre-wrap'}}
      >
        {contents}
      </div>
    )
  }
}

export default OpenStackPageInstanceDetailSectionItem
