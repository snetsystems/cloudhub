import React, {Component} from 'react'

import {ErrorHandling} from 'src/shared/decorators/errors'

import {DygraphClass, AnnotationViewer} from 'src/types'

import AnnotationViewerComponent from 'src/shared/components/AnnotationViewer'
import {visibleAnnotationsViewer} from 'src/shared/annotations/helpers'

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
    const filteredAnnotationsViewMode = visibleAnnotationsViewer(
      xAxisRange,
      annotationsViewMode
    )

    return (
      <div className="annotations-container">
        {filteredAnnotationsViewMode.map(a => (
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
