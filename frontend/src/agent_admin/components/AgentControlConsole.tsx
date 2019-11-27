// Libraries
import React, { PureComponent } from "react"

// Constants
import FancyScrollbar from "src/shared/components/FancyScrollbar"

interface Props {
  res: {}
}
class AgentControlConsole extends PureComponent<Props> {
  constructor(props) {
    super(props)
  }

  render() {
    const { res } = this.props
    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">Console</h2>
        </div>
        <div className="panel-body">
          <div
            className="console-zone"
            style={{
              background: "#232323",
              padding: "15px",
              borderRadius: "5px",
              height: "100%",
              width: "100%",
              resize: "none"
            }}
          >
            <FancyScrollbar>
              <pre className="console-zone--pre">
                {res}
              </pre>
            </FancyScrollbar>
          </div>
        </div>
      </div>
    )
  }
}

export default AgentControlConsole
