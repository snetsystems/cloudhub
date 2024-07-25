import React, {Component} from 'react'

import {ErrorHandling} from 'src/shared/decorators/errors'

import {DygraphClass, AnnotationViewer} from 'src/types'

import AnnotationViewerComponent from 'src/shared/components/AnnotationViewer'

interface Props {
  staticLegendHeight: number
  xAxisRange: [number, number]
  dygraph: DygraphClass
  annotationsViewMode: AnnotationViewer[]
}

@ErrorHandling
class AnnotationsViewer extends Component<Props> {
  public render() {
    const {
      dygraph,
      xAxisRange,
      staticLegendHeight,
      annotationsViewMode,
    } = this.props

    return (
      <div className="annotations-container">
        {annotationsViewMode.map(a => (
          <AnnotationViewerComponent
            key={a.id}
            xAxisRange={xAxisRange}
            annotationViewMode={a}
            dygraph={dygraph}
            staticLegendHeight={staticLegendHeight}
          />
        ))}
      </div>
    )
  }
}

export default AnnotationsViewer
