import React, { PureComponent } from "react";
import FancyScrollbar from "src/shared/components/FancyScrollbar";

class AgentMinionsConsole extends PureComponent {
  constructor(props) {
    super(props);
  }

  public prettyJson(jsonText) {
    if (!jsonText) {
      return jsonText;
    }

    var prettyJson = new Array();
    var depth = 0;
    var currChar;
    var prevChar;
    var doubleQuoteIn = false;

    for (var i = 0; i < jsonText.length; i++) {
      currChar = jsonText.charAt(i);

      if (currChar == '"') {
        if (prevChar != "\\") {
          doubleQuoteIn = !doubleQuoteIn;
        }
      }
      switch (currChar) {
        case "{":
          prettyJson.push(currChar);
          if (!doubleQuoteIn) {
            prettyJson.push("\n");
            this.insertTab(prettyJson, ++depth);
          }
          break;
        case "}":
          if (!doubleQuoteIn) {
            prettyJson.push("\n");
            this.insertTab(prettyJson, --depth);
          }
          prettyJson.push(currChar);
          break;
        case ",":
          prettyJson.push(currChar);
          if (!doubleQuoteIn) {
            prettyJson.push("\n");
            this.insertTab(prettyJson, depth);
          }
          break;
        default:
          prettyJson.push(currChar);
          break;
      }
      prevChar = currChar;
    }

    console.log(prettyJson);

    return prettyJson.join("");
  }

  public insertTab(prettyJson, depth) {
    const TAB = "";

    for (var i = 0; i < depth; i++) {
      prettyJson.push(TAB);
    }
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
              <pre
                style={{
                  color: "#fff",
                  whiteSpace: "pre-wrap",
                  backgroundColor: "transparent"
                }}
              >
                {res}
              </pre>
            </FancyScrollbar>
          </div>
        </div>
      </div>
    );
  }
}

export default AgentMinionsConsole;
