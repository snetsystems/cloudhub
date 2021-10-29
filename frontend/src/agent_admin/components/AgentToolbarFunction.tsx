// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import {AgentConfiguration} from 'src/agent_admin/containers/AgentConfiguration'

// Decorator
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  inoutkind: string
  name: string | null
  isActivity: boolean
  idx: number
  description: string
  focusedMeasure: string
  handleFocusedPlugin: AgentConfiguration['handleFocusedPlugin']
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
    const {name, isActivity} = this.props
    return (
      <>
        <div
          className="query-builder--list-item"
          style={{position: 'relative'}}
        >
          {`${name}`}
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
        </div>
      </>
    )
  }

  private handleFocusing = () => {
    const {handleFocusedPlugin} = this.props
    handleFocusedPlugin({_thisProps: this.props})
  }
}

export default AgentToolbarFunction
