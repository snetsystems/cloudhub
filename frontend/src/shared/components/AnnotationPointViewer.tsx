import React, {Component, CSSProperties} from 'react'
import classnames from 'classnames'

import AnnotationViewerTooltip from 'src/shared/components/AnnotationViewerTooltip'

import {
  DYGRAPH_CONTAINER_H_MARGIN,
  DYGRAPH_CONTAINER_V_MARGIN,
  DYGRAPH_CONTAINER_XLABEL_MARGIN,
} from 'src/shared/constants'
import {ErrorHandling} from 'src/shared/decorators/errors'

import {DygraphClass, AnnotationViewer} from 'src/types'

interface State {
  isMouseOver: boolean
}

interface Props {
  annotation: AnnotationViewer
  dygraph: DygraphClass
  staticLegendHeight: number
}

@ErrorHandling
class AnnotationPointViewer extends Component<Props, State> {
  public static defaultProps: Partial<Props> = {
    staticLegendHeight: 0,
  }

  public state = {
    isMouseOver: false,
  }

  public render() {
    const {annotation} = this.props

    return (
      <div className={this.markerClass} style={this.markerStyle}>
        <div
          className="annotation--click-area"
          onMouseEnter={this.handleMouseEnter}
          onMouseLeave={this.handleMouseLeave}
        />
        <div className={this.flagClass} />
        <AnnotationViewerTooltip
          timestamp={annotation.startTime}
          annotation={annotation}
          onMouseLeave={this.handleMouseLeave}
          annotationState={this.state}
        />
      </div>
    )
  }

  private handleMouseEnter = () => {
    this.setState({isMouseOver: true})
  }

  private handleMouseLeave = () => {
    this.setState({isMouseOver: false})
  }

  private get markerStyle(): CSSProperties {
    const {annotation, dygraph, staticLegendHeight} = this.props

    const left = `${
      dygraph.toDomXCoord(Number(annotation.startTime)) +
      DYGRAPH_CONTAINER_H_MARGIN
    }px`

    const height = `calc(100% - ${
      staticLegendHeight +
      DYGRAPH_CONTAINER_XLABEL_MARGIN +
      DYGRAPH_CONTAINER_V_MARGIN * 2
    }px)`

    return {
      left,
      height,
    }
  }

  private get markerClass(): string {
    const {isMouseOver} = this.state
    return classnames('annotation', {
      expanded: isMouseOver,
    })
  }

  private get flagClass(): string {
    return 'annotation-point--flag'
  }
}

export default AnnotationPointViewer
