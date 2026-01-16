// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import {TELEGRAF_PLUGINS} from 'src/agent_admin/constants/CollectorConfigTable'

// Decorator
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  inoutkind: string
  name: string | null
  isActivity: boolean
  idx: number
  category: string
  version: string
  description: string
  focusedMeasure: string
  handleFocusedPlugin: ({
    name,
    category,
  }: {
    name: string
    category: string
    idx: number
  }) => Promise<void>
  githubRef?: string
}

interface State {
  isActive: Readonly<Props>
}

@ErrorHandling
class AgentToolbarFunction extends PureComponent<Props, State> {
  private functionRef: React.RefObject<HTMLButtonElement> = React.createRef()
  constructor(props) {
    super(props)

    this.state = {
      isActive: props.isActivity,
    }
  }

  componentWillReceiveProps(newProps) {
    if (this.state.isActive !== newProps.isActivity) {
      this.setState({isActive: newProps.isActivity})
    }
  }

  componentWillUnmount() {}

  render() {
    const {name, isActivity, category, version} = this.props
    return (
      <>
        <div
          className="query-builder--list-item"
          style={{position: 'relative'}}
        >
          {`${name}`}
          {this.isLinkComponent(category) ? (
            <a
              style={{padding: '0 9.5px'}}
              className={
                isActivity
                  ? 'btn btn-primary item active'
                  : 'btn btn-primary item'
              }
              target="_blank"
              href={`https://github.com/snetsystems/telegraf/blob/${
                this.props.githubRef || `v${version}`
              }/plugins/${category}/${name}/README.md`}
            >
              <span
                style={{transform: 'none', margin: '0', fontSize: '11px'}}
                className="button-icon icon export"
              ></span>
            </a>
          ) : (
            <button
              className={
                isActivity
                  ? 'btn btn-primary item active'
                  : 'btn btn-primary item'
              }
              onClick={this.handleFocusing.bind(this)}
              ref={this.functionRef}
            >
              {`?`}
            </button>
          )}
        </div>
      </>
    )
  }

  private isLinkComponent(category) {
    return (
      category != TELEGRAF_PLUGINS.inputs &&
      category != TELEGRAF_PLUGINS.outputs
    )
  }

  private handleFocusing = () => {
    const {handleFocusedPlugin, name, category, idx} = this.props

    handleFocusedPlugin({name, category, idx})
  }
}

export default AgentToolbarFunction
