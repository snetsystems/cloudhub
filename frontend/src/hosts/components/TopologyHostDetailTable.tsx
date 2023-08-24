// libraries
import React, {PureComponent} from 'react'

interface Props {
  label: string
  contents: {
    [key: string]: {[info: string]: number | string | JSX.Element}
  }
}

interface State {}

class TopologyHostDetailTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {label} = this.props

    return (
      <div className={'section-item'} style={{flex: '0 0 25%'}}>
        <div className={'util-label'} style={{fontSize: '13px'}}>
          {label}
        </div>
        {this.renderContents}
      </div>
    )
  }

  renderValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.map((v, index) => (
        <div key={index} style={{lineHeight: 1.2}}>
          {this.renderValue(v)}
        </div>
      ))
    } else if (typeof value === 'boolean') {
      return <span>{value.toString()}</span>
    } else {
      return <span>{value}</span>
    }
  }
  private get renderContents() {
    const {contents} = this.props

    if (typeof contents === 'object' && !Array.isArray(contents)) {
      return (
        <div
          className={'section-item-contents'}
          style={{
            fontSize: '11px',
            marginLeft: 4,
          }}
        >
          {Object.keys(contents).map(key => (
            <div style={{display: 'flex', marginBottom: 5}} key={key}>
              <strong style={{fontSize: 12}}>{key}:</strong>
              <div style={{marginLeft: 6}}>
                {this.renderValue(contents[key])}
              </div>
            </div>
          ))}
        </div>
      )
    } else {
      return (
        <div
          className={'section-item-contents'}
          style={{
            flex: 3,
            fontSize: '11px',
            marginLeft: 4,
          }}
        >
          {contents}
        </div>
      )
    }
  }
}

export default TopologyHostDetailTable
