// libraries
import React, {PureComponent} from 'react'

interface Props {
  label: string
  contents: any
}
interface State {}
class TopologyHostDetailTable extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {label, contents} = this.props

    return (
      <div className={'section-item-detail-host'}>
        <div className={'util-label'} style={{fontSize: '13px'}}>
          {label}
        </div>
        <div
          className={'section-item-contents'}
          style={{
            fontSize: '11px',
            marginLeft: 4,
          }}
        >
          {this.renderValue(contents)}
        </div>
      </div>
    )
  }

  renderValue = (value: any, depth: number = 0): JSX.Element => {
    if (Array.isArray(value)) {
      return (
        <div>
          {value.map((v, index) => (
            <div key={index} style={{lineHeight: 1.2}}>
              {this.renderValue(v, depth + 1)}
            </div>
          ))}
        </div>
      )
    } else if (typeof value === 'object') {
      return (
        <div>
          {Object.keys(value).map(key => (
            <div key={key} style={{display: 'flex', marginBottom: 5}}>
              <strong style={{fontSize: 12}}>{key}:</strong>
              <div style={{marginLeft: 6}}>
                {this.renderValue(value[key], depth + 1)}
              </div>
            </div>
          ))}
        </div>
      )
    } else if (typeof value === 'boolean') {
      return <span>{value.toString()}</span>
    } else {
      return <span>{value}</span>
    }
  }
}

export default TopologyHostDetailTable
