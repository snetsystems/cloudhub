// Libraries
import React, {PureComponent} from 'react'

// Components
import CodeMirrorConsole from 'src/agent_admin/components/CodeMirrorConsole'

interface Props {
  res: string
}

class AgentMinionsConsole extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

  render() {
    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">Console</h2>
        </div>
        <div className="panel-body">
          <CodeMirrorConsole res={this.props.res} />
        </div>
      </div>
    )
  }
}

export default AgentMinionsConsole
