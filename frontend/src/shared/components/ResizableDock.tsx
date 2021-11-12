import React, {PureComponent} from 'react'
import {Resizable, ResizableProps} from 'react-resizable'
import classnames from 'classnames'

interface State {
  isDragging: boolean
}

interface Props extends ResizableProps {}

class ResizableDock extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      isDragging: false,
    }
  }

  public render() {
    return (
      <Resizable
        {...this.props}
        onResizeStart={() => {
          this.setState({isDragging: true})
        }}
        onResizeStop={() => {
          this.setState({isDragging: false})
        }}
        handle={
          <div
            className={classnames('resizable-handlebar', {
              dragging: this.state.isDragging,
            })}
          />
        }
      >
        <div
          className="resizable-dock"
          style={{
            width: this.props.width + 'px',
            right: `-${this.props.width}px`,
            height: `calc(100% - ${this.props.height}px)`,
          }}
        >
          <div className="resizable-children">{this.props.children}</div>
        </div>
      </Resizable>
    )
  }

  // private getParent = (target: HTMLElement) => {
  //   let currentParent = target
  //   while (currentParent) {
  //     if (
  //       window.getComputedStyle(currentParent).getPropertyValue('transform') !==
  //       'none'
  //     ) {
  //       break
  //     }
  //     currentParent = currentParent.parentElement
  //   }

  //   return currentParent.getBoundingClientRect()
  // }
}

export default ResizableDock
