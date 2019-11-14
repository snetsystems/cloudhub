import React, { PureComponent } from "react";
import FancyScrollbar from "src/shared/components/FancyScrollbar";

class AgentConsole extends PureComponent {
  constructor(props) {
    super(props);
  }

  render() {
    const { res } = this.props;
    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">Console</h2>
        </div>
        <div className="panel-body">
          <div
            style={{
              padding: "15px",
              height: "100%",
              width: "100%",
              background: "#232323",
              borderRadius: "5px"
            }}
          >
            <FancyScrollbar>
              <div
                className="console-zone"
                style={{
                  height: "100%"
                }}
              >
                {res}
              </div>
            </FancyScrollbar>
          </div>
        </div>
      </div>
    );
  }
}

export default AgentConsole;
