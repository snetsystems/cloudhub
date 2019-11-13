import React, { PureComponent } from "react";
import _ from "lodash";
import FunctionTooltip from "src/flux/components/flux_functions_toolbar/FunctionTooltip";
import { ErrorHandling } from "src/shared/decorators/errors";

@ErrorHandling
class AgentToolbarFunction extends PureComponent {
  private functionRef = React.createRef();
  constructor(props) {
    super(props);
    this.state = {
      isActive: false,
      clickPosition: undefined
    };
  }

  componentDidMount() {
    window.addEventListener("resize", this.handleResize);
  }

  public componentWillReceiveProps(newProps) {
    if (this.state.isActive === true) {
      this.setState({ isActive: false });
    }
  }

  componentWillUnmount() {}

  render() {
    const { name, idx } = this.props;
    return (
      <div
        className="query-builder--list-item"
        style={{ position: "relative" }}
      >
        {`${name}`}
        <div
          ref={this.functionRef}
          onClick={this.handleFocusing.bind(this)}
          onMouseLeave={this.handleOtherClick.bind(this)}
        >
          <button className={"btn btn-primary item" + idx}>
            {`help ${idx}`}
          </button>
          {this.tooltip}
        </div>
      </div>
    );
  }

  private handleResize = () => {
    this.handleOtherClick();
  };

  private handleFocusing = () => {
    const clickPosition = this.functionRef.current.getBoundingClientRect();
    this.props.handleFocusedMeasure({ clickPosition, refresh: true });
    this.setState({ isActive: true });
  };

  private handleOtherClick = () => {
    this.setState({ isActive: false });
    this.props.handleFocusedMeasure({ refresh: false });
  };

  private get tooltip(): JSX.Element {
    const { focusedPosition } = this.props;
    if (this.state.isActive) {
      const dummy = { desc: 123, args: 456, example: 678, link: "@link" };
      return (
        <FunctionTooltip
          func={dummy}
          onDismiss={this.handleOtherClick}
          tipPosition={focusedPosition}
          pivot={"left"}
        />
      );
    }
  }
}

export default AgentToolbarFunction;
