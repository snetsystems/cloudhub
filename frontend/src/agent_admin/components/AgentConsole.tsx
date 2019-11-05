import React, {PureComponent} from 'react'

class AgentConsole extends PureComponent {
  constructor(props) {
    super(props)
  }

  render() {
    const {res} = this.props
    console.log('res: ', res)
    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">Console</h2>
        </div>
        <div className="panel-body">
          <div
            className="console-zone"
            style={{
              background: '#232323',
              padding: '15px',
              borderRadius: '5px',
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              resize: 'none',
            }}
          >
            {res}
          </div>
        </div>
      </div>
    )
  }
}

export default AgentConsole
