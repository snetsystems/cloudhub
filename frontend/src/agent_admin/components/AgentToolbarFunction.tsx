import React, { PureComponent } from "react";
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
    const { refresh } = newProps;
    const { isActive } = this.state;

    if (refresh === true && isActive === true) {
      return this.handleOtherClick();
    }

    if (refresh === false && isActive === true) {
      return this.handleOtherClick();
    }

    if (refresh === false && isActive === false) {
      return this.handleOtherClick();
    }

    if (refresh) {
      const boolean = newProps.focusedMeasure === this.functionRef.current;
      return this.setState({ isActive: boolean });
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
        <button
          ref={this.functionRef}
          className={"btn btn-primary item" + idx}
          onClick={this.handleFocusing.bind(this)}
        >
          {`help ${idx}`}
        </button>
        {this.tooltip}
      </div>
    );
  }

  private handleResize = () => {
    this.handleOtherClick();
  };

  private handleFocusing = () => {
    const clickPosition = this.functionRef.current.getBoundingClientRect();
    this.props.handleFocusedMeasure({ clickPosition, refresh: true });
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
