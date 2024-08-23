import React, {FunctionComponent} from 'react'

import {DygraphClass, AnnotationViewer} from 'src/types'

import AnnotationPointViewMode from 'src/shared/components/AnnotationPointViewer'

interface Props {
  //dWidth: number
  xAxisRange: [number, number]
  annotationViewMode: AnnotationViewer
  dygraph: DygraphClass
  staticLegendHeight: number
}

const AnnotationViewer: FunctionComponent<Props> = ({
  dygraph,
  annotationViewMode,
  staticLegendHeight,
}) => (
  <div>
    <AnnotationPointViewMode
      dygraph={dygraph}
      annotation={annotationViewMode}
      staticLegendHeight={staticLegendHeight}
    />
    {/* {annotation.startTime === annotation.endTime ? (
      <AnnotationPoint
        dygraph={dygraph}
        annotation={annotation}
        dWidth={dWidth}
        staticLegendHeight={staticLegendHeight}
        xAxisRange={xAxisRange}
      />
    ) : (
      <AnnotationSpan
        mode={mode}
        dygraph={dygraph}
        annotation={annotation}
        dWidth={dWidth}
        staticLegendHeight={staticLegendHeight}
        xAxisRange={xAxisRange}
      />
    )} */}
  </div>
)

export default AnnotationViewer
