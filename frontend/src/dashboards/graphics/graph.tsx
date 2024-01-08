import React, {ReactElement} from 'react'

import {CellType} from 'src/types/dashboards'

type Graphic = ReactElement<HTMLDivElement>

interface GraphSVGs {
  [CellType.Line]: Graphic
  [CellType.Stacked]: Graphic
  [CellType.StepPlot]: Graphic
  [CellType.Bar]: Graphic
  [CellType.LinePlusSingleStat]: Graphic
  [CellType.SingleStat]: Graphic
  [CellType.Gauge]: Graphic
  [CellType.Table]: Graphic
  [CellType.Note]: Graphic
  [CellType.Histogram]: Graphic
  [CellType.StaticPie]: Graphic
  [CellType.StaticDoughnut]: Graphic
  [CellType.StaticScatter]: Graphic
  [CellType.StaticRadar]: Graphic
  [CellType.StaticStackedChart]: Graphic
  [CellType.StaticLineChart]: Graphic
}
const GRAPH_SVGS: GraphSVGs = {
  staticLineChart: (
    <div className="graph-type-selector--graphic">
      <svg
        viewBox="0 0 150 150"
        width="100%"
        height="100%"
        version="1.1"
        id="StaticLineChart"
        x="0px"
        y="0px"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-a"
          points="148,40 111.5,47.2 75,25 38.5,90.8 2,111.8 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-a"
          points="2,111.8 38.5,90.8 75,25 111.5,47.2 148,40 	"
        />
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-b"
          points="148,88.2 111.5,95.5 75,61.7 38.5,49.3 2,90.8 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-b"
          points="2,90.8 38.5,49.3 75,61.7 111.5,95.5 148,88.2 	"
        />
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-c"
          points="148,96 111.5,106.3 75,85.7 38.5,116.5 2,115 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-c"
          points="2,115 38.5,116.5 75,85.7 111.5,106.3 148,96 	"
        />
      </svg>
    </div>
  ),
  staticStackedChart: (
    <div className="graph-type-selector--graphic">
      <svg
        viewBox="0 0 150 150"
        width="100%"
        height="100%"
        version="1.1"
        id="StaticStackedChart"
        x="0px"
        y="0px"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <rect
          className="graph-type-selector--graphic-line graphic-line-a"
          width="26.799999"
          height="21.85733"
          x="1.9999996"
          y="102.28688"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-b"
          width="26.799999"
          height="15.068274"
          x="1.9999996"
          y="87.215126"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-c"
          width="26.799999"
          height="8.4023552"
          x="1.9999996"
          y="78.809258"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-a"
          width="26.799999"
          height="40.305695"
          x="31.800001"
          y="83.838524"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-b"
          width="26.799999"
          height="27.786432"
          x="31.800001"
          y="56.045654"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-c"
          width="26.799999"
          height="15.49424"
          x="31.800001"
          y="40.544941"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-a"
          width="26.799999"
          height="47.305618"
          x="91.400002"
          y="76.8386"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-b"
          width="26.799999"
          height="32.612118"
          x="91.400002"
          y="44.218922"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-c"
          width="26.799999"
          height="10.871027"
          x="91.400002"
          y="33.340321"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-a"
          width="26.799999"
          height="54.595627"
          x="61.599998"
          y="69.548592"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-b"
          width="26.799999"
          height="37.637794"
          x="61.599998"
          y="31.902079"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-c"
          width="26.799999"
          height="15.258255"
          x="61.599998"
          y="16.63508"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-a"
          width="26.799999"
          height="51.935741"
          x="121.2"
          y="72.208473"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-b"
          width="26.799999"
          height="35.804092"
          x="121.2"
          y="36.396095"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-c"
          width="26.799999"
          height="12.584609"
          x="121.2"
          y="23.803171"
        />

        <rect
          className="graph-type-selector--graphic-fill graphic-fill-a"
          width="26.799999"
          height="21.85733"
          x="1.9999996"
          y="102.28688"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-b"
          width="26.799999"
          height="15.068274"
          x="1.9999996"
          y="87.215126"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-c"
          width="26.799999"
          height="8.4023552"
          x="1.9999996"
          y="78.809258"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-a"
          width="26.799999"
          height="40.305695"
          x="31.800001"
          y="83.838524"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-b"
          width="26.799999"
          height="27.786432"
          x="31.800001"
          y="56.045654"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-c"
          width="26.799999"
          height="15.49424"
          x="31.800001"
          y="40.544941"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-a"
          width="26.799999"
          height="47.305618"
          x="91.400002"
          y="76.8386"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-b"
          width="26.799999"
          height="32.612118"
          x="91.400002"
          y="44.218922"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-c"
          width="26.799999"
          height="10.871027"
          x="91.400002"
          y="33.340321"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-a"
          width="26.799999"
          height="54.595627"
          x="61.599998"
          y="69.548592"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-b"
          width="26.799999"
          height="37.637794"
          x="61.599998"
          y="31.902079"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-c"
          width="26.799999"
          height="15.258255"
          x="61.599998"
          y="16.63508"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-a"
          width="26.799999"
          height="51.935741"
          x="121.2"
          y="72.208473"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-b"
          width="26.799999"
          height="35.804092"
          x="121.2"
          y="36.396095"
        />
        <rect
          className="graph-type-selector--graphic-fill graphic-fill-c"
          width="26.799999"
          height="12.584609"
          x="121.2"
          y="23.803171"
        />
      </svg>
    </div>
  ),
  staticRadar: (
    <div className="graph-type-selector--graphic">
      <svg
        viewBox="0 0 150 150"
        width="100%"
        height="100%"
        version="1.1"
        id="StaticRadar"
        x="0px"
        y="0px"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="m26.841 61.132 17.938 57.563 57.857-3.896 24.555-55.285L74.736 20.95Z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="m26.841 61.132 17.938 57.563 57.857-3.896 24.555-55.285L74.736 20.95Z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="m42.72 66.792 32.274-24.407 30.215 25.51-8.013 39.405-44.183.367Z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="m42.72 66.792 32.274-24.407 30.215 25.51-8.013 39.405-44.183.367Z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="M74.898 49.493C51.842 68.596 50.2 69.352 50.2 69.352l5.167 35.59 32.723-9.245 10.718-26.139z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="M74.898 49.493C51.842 68.596 50.2 69.352 50.2 69.352l5.167 35.59 32.723-9.245 10.718-26.139z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-d"
          d="m109.679 124.051-68.993.192L19.185 58.2l55.704-41.01 55.928 40.7Z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-d"
          d="m99.032 109.942-47.975.33L33.55 63.546l41.283-32.184 41.405 32.278Z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-d"
          d="M19.202 58.219 74.85 78.205l-44.938-16.14ZM75.03 78.69l-34.38 45.595Z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-d"
          d="m74.807 17.212.198 61.049zm56.631 40.87L74.614 78.48Zm-21.68 66.069L74.974 78.217Z"
        />
      </svg>
    </div>
  ),
  staticScatter: (
    <div className="graph-type-selector--graphic">
      <svg
        viewBox="0 0 150 150"
        width="100%"
        height="100%"
        version="1.1"
        id="StaticScatter"
        x="0px"
        y="0px"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="M 15.289455,15.750441 V 123.47933 H 136.12866"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="m 27.011062,111.95665 a 3.0594244,2.6651985 0 0 1 -3.020965,2.66499 3.0594244,2.6651985 0 0 1 -3.096917,-2.59798 3.0594244,2.6651985 0 0 1 2.943103,-2.73031 3.0594244,2.6651985 0 0 1 3.170912,2.52934"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="m 27.011062,111.95665 a 3.0594244,2.6651985 0 0 1 -3.020965,2.66499 3.0594244,2.6651985 0 0 1 -3.096917,-2.59798 3.0594244,2.6651985 0 0 1 2.943103,-2.73031 3.0594244,2.6651985 0 0 1 3.170912,2.52934"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="m 36.484914,93.106676 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664987 3.0594244,2.6651985 0 0 1 -3.096917,-2.597985 3.0594244,2.6651985 0 0 1 2.943103,-2.730306 3.0594244,2.6651985 0 0 1 3.170912,2.529342"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="m 36.484914,93.106676 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664987 3.0594244,2.6651985 0 0 1 -3.096917,-2.597985 3.0594244,2.6651985 0 0 1 2.943103,-2.730306 3.0594244,2.6651985 0 0 1 3.170912,2.529342"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="m 50.550048,115.94132 a 3.0594244,2.6651985 0 0 1 -3.020965,2.66499 3.0594244,2.6651985 0 0 1 -3.096917,-2.59798 3.0594244,2.6651985 0 0 1 2.943104,-2.73031 3.0594244,2.6651985 0 0 1 3.170911,2.52934"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="m 50.550048,115.94132 a 3.0594244,2.6651985 0 0 1 -3.020965,2.66499 3.0594244,2.6651985 0 0 1 -3.096917,-2.59798 3.0594244,2.6651985 0 0 1 2.943104,-2.73031 3.0594244,2.6651985 0 0 1 3.170911,2.52934"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="m 68.451121,107.58719 a 3.0594244,2.6651985 0 0 1 -3.020965,2.66499 3.0594244,2.6651985 0 0 1 -3.096916,-2.59798 3.0594244,2.6651985 0 0 1 2.943104,-2.73031 3.0594244,2.6651985 0 0 1 3.17091,2.52934"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="m 68.451121,107.58719 a 3.0594244,2.6651985 0 0 1 -3.020965,2.66499 3.0594244,2.6651985 0 0 1 -3.096916,-2.59798 3.0594244,2.6651985 0 0 1 2.943104,-2.73031 3.0594244,2.6651985 0 0 1 3.17091,2.52934"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="m 40.320864,78.06921 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664989 3.0594244,2.6651985 0 0 1 -3.096917,-2.597987 3.0594244,2.6651985 0 0 1 2.943104,-2.730306 3.0594244,2.6651985 0 0 1 3.170911,2.529343"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="m 40.320864,78.06921 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664989 3.0594244,2.6651985 0 0 1 -3.096917,-2.597987 3.0594244,2.6651985 0 0 1 2.943104,-2.730306 3.0594244,2.6651985 0 0 1 3.170911,2.529343"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="m 56.303962,89.208067 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664989 3.0594244,2.6651985 0 0 1 -3.096918,-2.597987 3.0594244,2.6651985 0 0 1 2.943104,-2.730306 3.0594244,2.6651985 0 0 1 3.170911,2.529343"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="m 56.303962,89.208067 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664989 3.0594244,2.6651985 0 0 1 -3.096918,-2.597987 3.0594244,2.6651985 0 0 1 2.943104,-2.730306 3.0594244,2.6651985 0 0 1 3.170911,2.529343"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="m 70.369087,88.651133 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664988 3.0594244,2.6651985 0 0 1 -3.096916,-2.597987 3.0594244,2.6651985 0 0 1 2.943103,-2.730304 3.0594244,2.6651985 0 0 1 3.170911,2.529341"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="m 70.369087,88.651133 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664988 3.0594244,2.6651985 0 0 1 -3.096916,-2.597987 3.0594244,2.6651985 0 0 1 2.943103,-2.730304 3.0594244,2.6651985 0 0 1 3.170911,2.529341"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="m 82.516243,100.90388 a 3.0594244,2.6651985 0 0 1 -3.020965,2.66499 3.0594244,2.6651985 0 0 1 -3.096918,-2.59799 3.0594244,2.6651985 0 0 1 2.943104,-2.730302 3.0594244,2.6651985 0 0 1 3.170911,2.529342"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="m 82.516243,100.90388 a 3.0594244,2.6651985 0 0 1 -3.020965,2.66499 3.0594244,2.6651985 0 0 1 -3.096918,-2.59799 3.0594244,2.6651985 0 0 1 2.943104,-2.730302 3.0594244,2.6651985 0 0 1 3.170911,2.529342"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="m 84.434214,91.43585 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664988 3.0594244,2.6651985 0 0 1 -3.096917,-2.597987 3.0594244,2.6651985 0 0 1 2.943104,-2.730304 3.0594244,2.6651985 0 0 1 3.170911,2.529341"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="m 84.434214,91.43585 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664988 3.0594244,2.6651985 0 0 1 -3.096917,-2.597987 3.0594244,2.6651985 0 0 1 2.943104,-2.730304 3.0594244,2.6651985 0 0 1 3.170911,2.529341"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="m 65.254492,64.702577 a 3.0594244,2.6651985 0 0 1 -3.020964,2.664987 3.0594244,2.6651985 0 0 1 -3.096918,-2.597985 3.0594244,2.6651985 0 0 1 2.943104,-2.730306 3.0594244,2.6651985 0 0 1 3.170911,2.529342"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="m 65.254492,64.702577 a 3.0594244,2.6651985 0 0 1 -3.020964,2.664987 3.0594244,2.6651985 0 0 1 -3.096918,-2.597985 3.0594244,2.6651985 0 0 1 2.943104,-2.730306 3.0594244,2.6651985 0 0 1 3.170911,2.529342"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="m 91.466774,66.373408 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664988 3.0594244,2.6651985 0 0 1 -3.096916,-2.597985 3.0594244,2.6651985 0 0 1 2.943103,-2.730306 3.0594244,2.6651985 0 0 1 3.170912,2.529341"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="m 91.466774,66.373408 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664988 3.0594244,2.6651985 0 0 1 -3.096916,-2.597985 3.0594244,2.6651985 0 0 1 2.943103,-2.730306 3.0594244,2.6651985 0 0 1 3.170912,2.529341"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="m 106.81054,82.524748 a 3.0594244,2.6651985 0 0 1 -3.02097,2.664988 3.0594244,2.6651985 0 0 1 -3.09691,-2.597985 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17091,2.529341"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="m 106.81054,82.524748 a 3.0594244,2.6651985 0 0 1 -3.02097,2.664988 3.0594244,2.6651985 0 0 1 -3.09691,-2.597985 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17091,2.529341"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="m 108.08921,59.133149 a 3.0594244,2.6651985 0 0 1 -3.02097,2.664988 3.0594244,2.6651985 0 0 1 -3.09692,-2.597987 3.0594244,2.6651985 0 0 1 2.94311,-2.730304 3.0594244,2.6651985 0 0 1 3.17091,2.529341"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="m 108.08921,59.133149 a 3.0594244,2.6651985 0 0 1 -3.02097,2.664988 3.0594244,2.6651985 0 0 1 -3.09692,-2.597987 3.0594244,2.6651985 0 0 1 2.94311,-2.730304 3.0594244,2.6651985 0 0 1 3.17091,2.529341"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="m 73.5657,58.019262 a 3.0594244,2.6651985 0 0 1 -3.020964,2.664989 3.0594244,2.6651985 0 0 1 -3.096918,-2.597986 3.0594244,2.6651985 0 0 1 2.943104,-2.730306 3.0594244,2.6651985 0 0 1 3.170911,2.529343"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="m 73.5657,58.019262 a 3.0594244,2.6651985 0 0 1 -3.020964,2.664989 3.0594244,2.6651985 0 0 1 -3.096918,-2.597986 3.059244,2.6651985 0 0 1 2.943104,-2.730306 3.0594244,2.6651985 0 0 1 3.170911,2.529343"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="m 80.598271,36.298471 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664987 3.0594244,2.6651985 0 0 1 -3.096916,-2.597986 3.0594244,2.6651985 0 0 1 2.943104,-2.730305 3.0594244,2.6651985 0 0 1 3.170911,2.529341"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="m 80.598271,36.298471 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664987 3.0594244,2.6651985 0 0 1 -3.096916,-2.597986 3.0594244,2.6651985 0 0 1 2.943104,-2.730305 3.0594244,2.6651985 0 0 1 3.170911,2.529341"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="m 106.81054,42.424857 a 3.0594244,2.6651985 0 0 1 -3.02097,2.664989 3.0594244,2.6651985 0 0 1 -3.09691,-2.597986 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17091,2.529342"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="m 106.81054,42.424857 a 3.0594244,2.6651985 0 0 1 -3.02097,2.664989 3.0594244,2.6651985 0 0 1 -3.09691,-2.597986 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17091,2.529342"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="m 130.40374,76.468119 a 3.0594244,2.6651985 0 0 1 -3.02096,2.664988 3.0594244,2.6651985 0 0 1 -3.09692,-2.597985 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17091,2.529341"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="m 130.40374,76.468119 a 3.0594244,2.6651985 0 0 1 -3.02096,2.664988 3.0594244,2.6651985 0 0 1 -3.09692,-2.597985 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17091,2.529341"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="m 131.07396,43.538738 a 3.0594244,2.6651985 0 0 1 -3.02096,2.664988 3.0594244,2.6651985 0 0 1 -3.09692,-2.597985 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17092,2.529341"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="m 131.07396,43.538738 a 3.0594244,2.6651985 0 0 1 -3.02096,2.664988 3.0594244,2.6651985 0 0 1 -3.09692,-2.597985 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17092,2.529341"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="m 123.43295,32.956808 a 3.0594244,2.6651985 0 0 1 -3.02096,2.664988 3.0594244,2.6651985 0 0 1 -3.09692,-2.597986 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17092,2.529342"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="m 123.43295,32.956808 a 3.0594244,2.6651985 0 0 1 -3.02096,2.664988 3.0594244,2.6651985 0 0 1 -3.09692,-2.597986 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17092,2.529342"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="m 93.536853,23.279565 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664988 3.0594244,2.6651985 0 0 1 -3.096918,-2.597987 3.0594244,2.6651985 0 0 1 2.943104,-2.730304 3.0594244,2.6651985 0 0 1 3.170911,2.529341"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="m 93.536853,23.279565 a 3.0594244,2.6651985 0 0 1 -3.020965,2.664988 3.0594244,2.6651985 0 0 1 -3.096918,-2.597987 3.0594244,2.6651985 0 0 1 2.943104,-2.730304 3.0594244,2.6651985 0 0 1 3.170911,2.529341"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="m 128.60817,22.339558 a 3.0594244,2.6651985 0 0 1 -3.02096,2.664989 3.0594244,2.6651985 0 0 1 -3.09692,-2.597987 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17091,2.529343"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="m 128.60817,22.339558 a 3.0594244,2.6651985 0 0 1 -3.02096,2.664989 3.0594244,2.6651985 0 0 1 -3.09692,-2.597987 3.0594244,2.6651985 0 0 1 2.9431,-2.730306 3.0594244,2.6651985 0 0 1 3.17091,2.529343"
        />
      </svg>
    </div>
  ),
  staticDoughnut: (
    <div className="graph-type-selector--graphic">
      <svg
        viewBox="0 0 150 150"
        width="100%"
        height="100%"
        version="1.1"
        id="StaticDoughnut"
        x="0px"
        y="0px"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="M73.037 124.824c-12.059-.485-23.367-4.803-32.912-12.567-3.325-2.704-6.928-6.588-9.54-10.286-1.108-1.568-2.62-3.975-2.62-4.17 0-.105 23.048-13.488 23.227-13.488.034 0 .343.434.687.963 3.253 5.015 8.373 9.03 14.075 11.042 5.256 1.854 11.53 2.008 16.857.415 6.57-1.965 11.828-5.948 15.6-11.82 1.26-1.962 2.43-4.603 3.144-7.105 1.597-5.59 1.351-11.707-.69-17.158-2.474-6.609-7.565-12.173-13.877-15.167-3.517-1.667-6.28-2.369-10.696-2.714l-1.109-.087V15.696l1.467.07c5.935.281 10.658 1.14 15.846 2.88 6.305 2.114 12.075 5.316 17.312 9.606 1.962 1.607 5.77 5.41 7.318 7.306 6.923 8.483 11.033 18.31 12.228 29.239.295 2.693.292 8.354-.005 11.072-.751 6.878-2.328 12.332-5.317 18.393-5.465 11.08-13.853 19.488-24.882 24.94a54.171 54.171 0 0 1-19.174 5.417c-1.814.163-5.375.268-6.94.205z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="M73.037 124.824c-12.059-.485-23.367-4.803-32.912-12.567-3.325-2.704-6.928-6.588-9.54-10.286-1.108-1.568-2.62-3.975-2.62-4.17 0-.105 23.048-13.488 23.227-13.488.034 0 .343.434.687.963 3.253 5.015 8.373 9.03 14.075 11.042 5.256 1.854 11.53 2.008 16.857.415 6.57-1.965 11.828-5.948 15.6-11.82 1.26-1.962 2.43-4.603 3.144-7.105 1.597-5.59 1.351-11.707-.69-17.158-2.474-6.609-7.565-12.173-13.877-15.167-3.517-1.667-6.28-2.369-10.696-2.714l-1.109-.087V15.696l1.467.07c5.935.281 10.658 1.14 15.846 2.88 6.305 2.114 12.075 5.316 17.312 9.606 1.962 1.607 5.77 5.41 7.318 7.306 6.923 8.483 11.033 18.31 12.228 29.239.295 2.693.292 8.354-.005 11.072-.751 6.878-2.328 12.332-5.317 18.393-5.465 11.08-13.853 19.488-24.882 24.94a54.171 54.171 0 0 1-19.174 5.417c-1.814.163-5.375.268-6.94.205z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="M26.74 95.724c-4.553-8.577-6.808-18.83-6.222-28.286.16-2.577.577-6.192.734-6.346.07-.07 26.438 4.566 26.538 4.666.038.038-.002.544-.09 1.126-.208 1.401-.21 5.325-.002 6.849.465 3.407 1.445 6.568 2.846 9.185.318.593.464 1.01.38 1.085-.254.226-23.06 13.321-23.198 13.321-.075 0-.52-.72-.986-1.6z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="M26.74 95.724c-4.553-8.577-6.808-18.83-6.222-28.286.16-2.577.577-6.192.734-6.346.07-.07 26.438 4.566 26.538 4.666.038.038-.002.544-.09 1.126-.208 1.401-.21 5.325-.002 6.849.465 3.407 1.445 6.568 2.846 9.185.318.593.464 1.01.38 1.085-.254.226-23.06 13.321-23.198 13.321-.075 0-.52-.72-.986-1.6z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="M34.332 62.95c-7.161-1.274-13.01-2.377-12.999-2.451.382-2.376 1.424-6.144 2.53-9.142 3.408-9.247 9.431-17.568 17.165-23.715 9.244-7.348 20.107-11.345 32.26-11.869l1.609-.07v26.98l-.966.084c-.531.046-1.577.152-2.325.237-9.177 1.04-17.462 7.02-21.474 15.502-.856 1.81-1.603 3.951-1.935 5.547-.226 1.084-.296 1.242-.551 1.23-.161-.009-6.152-1.058-13.314-2.332z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="M34.332 62.95c-7.161-1.274-13.01-2.377-12.999-2.451.382-2.376 1.424-6.144 2.53-9.142 3.408-9.247 9.431-17.568 17.165-23.715 9.244-7.348 20.107-11.345 32.26-11.869l1.609-.07v26.98l-.966.084c-.531.046-1.577.152-2.325.237-9.177 1.04-17.462 7.02-21.474 15.502-.856 1.81-1.603 3.951-1.935 5.547-.226 1.084-.296 1.242-.551 1.23-.161-.009-6.152-1.058-13.314-2.332z"
        />
      </svg>
    </div>
  ),
  staticPie: (
    <div className="graph-type-selector--graphic">
      <svg
        viewBox="0 0 150 150"
        width="100%"
        height="100%"
        version="1.1"
        id="StaticPie"
        x="0px"
        y="0px"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="M72.943 125.287c-16.99-.683-32.847-9.21-42.496-22.848-1.11-1.568-2.623-3.974-2.623-4.17 0-.068 10.62-6.246 23.598-13.728L75.02 70.936l.036-27.376.037-27.377 1.467.07c11.435.542 21.275 3.857 30.14 10.153 20.165 14.321 28.123 40.61 19.317 63.811-8.207 21.622-29.965 36-53.074 35.07z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="M72.943 125.287c-16.99-.683-32.847-9.21-42.496-22.848-1.11-1.568-2.623-3.974-2.623-4.17 0-.068 10.62-6.246 23.598-13.728L75.02 70.936l.036-27.376.037-27.377 1.467.07c11.435.542 21.275 3.857 30.14 10.153 20.165 14.321 28.123 40.61 19.317 63.811-8.207 21.622-29.965 36-53.074 35.07z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="M26.583 96.112c-2.93-5.568-4.824-11.468-5.802-18.076-.465-3.14-.474-11.43-.016-14.453.165-1.086.322-1.995.35-2.018.077-.067 53.117 9.274 53.113 9.354-.002.04-1.081.687-2.398 1.44-1.318.751-11.788 6.782-23.268 13.4-11.48 6.619-20.923 12.034-20.984 12.033-.061 0-.51-.756-.995-1.68z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="M26.583 96.112c-2.93-5.568-4.824-11.468-5.802-18.076-.465-3.14-.474-11.43-.016-14.453.165-1.086.322-1.995.35-2.018.077-.067 53.117 9.274 53.113 9.354-.002.04-1.081.687-2.398 1.44-1.318.751-11.788 6.782-23.268 13.4-11.48 6.619-20.923 12.034-20.984 12.033-.061 0-.51-.756-.995-1.68z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="M47.59 65.786c-14.534-2.571-26.416-4.736-26.404-4.81 1.16-7.213 4.954-16.021 9.631-22.362 10.05-13.626 25.23-21.645 42.305-22.35l1.683-.07v54.297l-.393-.015c-.217-.008-12.286-2.118-26.821-4.69z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="M47.59 65.786c-14.534-2.571-26.416-4.736-26.404-4.81 1.16-7.213 4.954-16.021 9.631-22.362 10.05-13.626 25.23-21.645 42.305-22.35l1.683-.07v54.297l-.393-.015c-.217-.008-12.286-2.118-26.821-4.69z"
        />
      </svg>
    </div>
  ),
  histogram: (
    <div className="graph-type-selector--graphic">
      <svg
        width="100%"
        height="100%"
        version="1.1"
        id="Bar"
        x="0px"
        y="0px"
        viewBox="0 0 150 150"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <rect
          x="0"
          y="108.4"
          className="graph-type-selector--graphic-line graphic-line-a"
          width="26.8"
          height="16.6"
        />
        <rect
          x="27.8"
          y="82.4"
          className="graph-type-selector--graphic-line graphic-line-b"
          width="26.8"
          height="42.6"
        />
        <rect
          x="54.6"
          y="28.8"
          className="graph-type-selector--graphic-line graphic-line-c"
          width="26.8"
          height="96.2"
        />
        <rect
          x="81.4"
          y="47.9"
          className="graph-type-selector--graphic-line graphic-line-a"
          width="26.8"
          height="77.1"
        />
        <rect
          x="108.2"
          y="25"
          className="graph-type-selector--graphic-line graphic-line-b"
          width="26.8"
          height="100"
        />

        <rect
          x="0"
          y="108.4"
          className="graph-type-selector--graphic-fill graphic-fill-a"
          width="26.8"
          height="16.6"
        />
        <rect
          x="27.8"
          y="82.4"
          className="graph-type-selector--graphic-fill graphic-fill-b"
          width="26.8"
          height="42.6"
        />
        <rect
          x="54.6"
          y="28.8"
          className="graph-type-selector--graphic-fill graphic-fill-c"
          width="26.8"
          height="96.2"
        />
        <rect
          x="81.4"
          y="47.9"
          className="graph-type-selector--graphic-fill graphic-fill-a"
          width="26.8"
          height="77.1"
        />
        <rect
          x="108.2"
          y="25"
          className="graph-type-selector--graphic-fill graphic-fill-b"
          width="26.8"
          height="100"
        />
      </svg>
    </div>
  ),
  line: (
    <div className="graph-type-selector--graphic">
      <svg
        width="100%"
        height="100%"
        version="1.1"
        id="Line"
        x="0px"
        y="0px"
        viewBox="0 0 150 150"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-a"
          points="148,40 111.5,47.2 75,25 38.5,90.8 2,111.8 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-a"
          points="2,111.8 38.5,90.8 75,25 111.5,47.2 148,40 	"
        />
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-b"
          points="148,88.2 111.5,95.5 75,61.7 38.5,49.3 2,90.8 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-b"
          points="2,90.8 38.5,49.3 75,61.7 111.5,95.5 148,88.2 	"
        />
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-c"
          points="148,96 111.5,106.3 75,85.7 38.5,116.5 2,115 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-c"
          points="2,115 38.5,116.5 75,85.7 111.5,106.3 148,96 	"
        />
      </svg>
    </div>
  ),
  'line-stacked': (
    <div className="graph-type-selector--graphic">
      <svg
        width="100%"
        height="100%"
        version="1.1"
        id="LineStacked"
        x="0px"
        y="0px"
        viewBox="0 0 150 150"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-a"
          points="148,25 111.5,25 75,46 38.5,39.1 2,85.5 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-a"
          points="2,85.5 38.5,39.1 75,46 111.5,25 148,25 	"
        />
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-b"
          points="148,53 111.5,49.9 75,88.5 38.5,71 2,116 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-b"
          points="2,116 38.5,71 75,88.5 111.5,49.9 148,53 	"
        />
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-c"
          points="148,86.2 111.5,88.6 75,108.6 38.5,98 2,121.1 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-c"
          points="2,121.1 38.5,98 75,108.6 111.5,88.6 148,86.2 	"
        />
      </svg>
    </div>
  ),
  'line-stepplot': (
    <div className="graph-type-selector--graphic">
      <svg
        width="100%"
        height="100%"
        version="1.1"
        id="StepPlot"
        x="0px"
        y="0px"
        viewBox="0 0 150 150"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-a"
          points="148,61.9 129.8,61.9 129.8,25 93.2,25 93.2,40.6 56.8,40.6 56.8,25 20.2,25 20.2,67.8 2,67.8 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-a"
          points="2,67.8 20.2,67.8 20.2,25 56.8,25 56.8,40.6 93.2,40.6 93.2,25 129.8,25 129.8,61.9 148,61.9 	"
        />
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-b"
          points="148,91.9 129.8,91.9 129.8,70.2 93.2,70.2 93.2,67 56.8,67 56.8,50.1 20.2,50.1 20.2,87 2,87 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-b"
          points="2,87 20.2,87 20.2,50.1 56.8,50.1 56.8,67 93.2,67 93.2,70.2 129.8,70.2 129.8,91.9 148,91.9 	"
        />
        <polygon
          className="graph-type-selector--graphic-fill graphic-fill-c"
          points="148,103.5 129.8,103.5 129.8,118.2 93.2,118.2 93.2,84.5 56.8,84.5 56.8,75 20.2,75 20.2,100.2 2,100.2 2,125 148,125 	"
        />
        <polyline
          className="graph-type-selector--graphic-line graphic-line-c"
          points="2,100.2 20.2,100.2 20.2,75 56.8,75 56.8,84.5 93.2,84.5 93.2,118.2 129.8,118.2 129.8,103.5 148,103.5 	"
        />
      </svg>
    </div>
  ),
  'single-stat': (
    <div className="graph-type-selector--graphic">
      <svg
        width="100%"
        height="100%"
        version="1.1"
        id="SingleStat"
        x="0px"
        y="0px"
        viewBox="0 0 150 150"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M35.6,80.4h4.9v1.1h-4.9v7.8h-1.1v-7.8H20.7v-0.6l13.6-20.1h1.3V80.4z M22.4,80.4h12.1V62.1l-1.6,2.7 L22.4,80.4z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M58.6,75.1c-0.7,1.5-1.8,2.7-3.2,3.6c-1.5,0.9-3.1,1.4-4.9,1.4c-1.6,0-3-0.4-4.2-1.3s-2.2-2-2.9-3.5 c-0.7-1.5-1.1-3.1-1.1-4.8c0-1.9,0.4-3.6,1.1-5.1c0.7-1.6,1.7-2.8,3-3.7c1.3-0.9,2.7-1.3,4.3-1.3c2.9,0,5.2,1,6.7,2.9 c1.5,1.9,2.3,4.7,2.3,8.3v3.3c0,4.8-1.1,8.5-3.2,11c-2.1,2.5-5.3,3.8-9.4,3.9H46l0-1.1h0.8c3.8,0,6.7-1.2,8.7-3.5 C57.6,82.8,58.6,79.5,58.6,75.1z M50.4,79c1.9,0,3.6-0.6,5.1-1.7s2.5-2.6,3-4.5v-1.2c0-3.3-0.7-5.8-2-7.5c-1.4-1.7-3.3-2.6-5.8-2.6 c-1.4,0-2.7,0.4-3.8,1.2s-2,1.9-2.6,3.3c-0.6,1.4-0.9,2.9-0.9,4.5c0,1.5,0.3,3,0.9,4.3c0.6,1.3,1.5,2.4,2.5,3.1 C47.8,78.7,49.1,79,50.4,79z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M81.3,89.2h-17v-1.1L74,77c1.6-1.9,2.8-3.5,3.5-5c0.8-1.4,1.2-2.8,1.2-4c0-2.1-0.6-3.7-1.8-4.9 c-1.2-1.2-2.9-1.7-5.1-1.7c-1.3,0-2.5,0.3-3.6,1c-1.1,0.6-2,1.5-2.6,2.6c-0.6,1.1-0.9,2.4-0.9,3.8h-1.1c0-1.5,0.4-2.9,1.1-4.2 c0.7-1.3,1.7-2.3,2.9-3.1s2.6-1.1,4.2-1.1c2.5,0,4.5,0.7,5.9,2c1.4,1.3,2.1,3.2,2.1,5.6c0,2.2-1.2,4.9-3.7,7.9l-1.8,2.2l-8.6,10 h15.6V89.2z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M85.3,88.3c0-0.3,0.1-0.6,0.3-0.8c0.2-0.2,0.5-0.3,0.8-0.3c0.3,0,0.6,0.1,0.8,0.3s0.3,0.5,0.3,0.8 c0,0.3-0.1,0.6-0.3,0.8s-0.5,0.3-0.8,0.3c-0.3,0-0.6-0.1-0.8-0.3C85.4,88.8,85.3,88.6,85.3,88.3z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M92.7,74.3L94,60.8h13.9v1.1H95l-1.2,11.4c0.7-0.6,1.6-1,2.7-1.4s2.2-0.5,3.3-0.5c2.6,0,4.6,0.8,6.1,2.4 c1.5,1.6,2.3,3.8,2.3,6.4c0,3.1-0.7,5.4-2.1,7c-1.4,1.6-3.4,2.4-5.9,2.4c-2.4,0-4.4-0.7-5.9-2.1c-1.5-1.4-2.3-3.3-2.5-5.8h1.1 c0.2,2.2,0.9,3.9,2.2,5.1c1.2,1.2,3,1.7,5.2,1.7c2.3,0,4.1-0.7,5.2-2.1c1.1-1.4,1.7-3.5,1.7-6.2c0-2.4-0.7-4.3-2-5.7 c-1.3-1.4-3.1-2.1-5.3-2.1c-1.4,0-2.6,0.2-3.6,0.5c-1,0.4-1.9,0.9-2.7,1.7L92.7,74.3z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M113.8,74.3l1.3-13.6H129v1.1h-12.9l-1.2,11.4c0.7-0.6,1.6-1,2.7-1.4s2.2-0.5,3.3-0.5c2.6,0,4.6,0.8,6.1,2.4 c1.5,1.6,2.3,3.8,2.3,6.4c0,3.1-0.7,5.4-2.1,7c-1.4,1.6-3.4,2.4-5.9,2.4c-2.4,0-4.4-0.7-5.9-2.1c-1.5-1.4-2.3-3.3-2.5-5.8h1.1 c0.2,2.2,0.9,3.9,2.2,5.1c1.2,1.2,3,1.7,5.2,1.7c2.3,0,4.1-0.7,5.2-2.1c1.1-1.4,1.7-3.5,1.7-6.2c0-2.4-0.7-4.3-2-5.7 c-1.3-1.4-3.1-2.1-5.3-2.1c-1.4,0-2.6,0.2-3.6,0.5c-1,0.4-1.9,0.9-2.7,1.7L113.8,74.3z"
        />
      </svg>
    </div>
  ),
  'line-plus-single-stat': (
    <div className="graph-type-selector--graphic">
      <svg
        width="100%"
        height="100%"
        version="1.1"
        id="LineAndSingleStat"
        x="0px"
        y="0px"
        viewBox="0 0 150 150"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <g>
          <polygon
            className="graph-type-selector--graphic-fill graphic-fill-c"
            points="148,88.2 111.5,95.5 75,25 38.5,54.7 2,66.7 2,125 148,125"
          />
          <polyline
            className="graph-type-selector--graphic-line graphic-line-c"
            points="2,66.7 38.5,54.7 75,25 111.5,95.5 148,88.2"
          />
        </g>
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M35.6,80.4h4.9v1.1h-4.9v7.8h-1.1v-7.8H20.7v-0.6l13.6-20.1h1.3V80.4z M22.4,80.4h12.1V62.1l-1.6,2.7 L22.4,80.4z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M58.6,75.1c-0.7,1.5-1.8,2.7-3.2,3.6c-1.5,0.9-3.1,1.4-4.9,1.4c-1.6,0-3-0.4-4.2-1.3s-2.2-2-2.9-3.5 c-0.7-1.5-1.1-3.1-1.1-4.8c0-1.9,0.4-3.6,1.1-5.1c0.7-1.6,1.7-2.8,3-3.7c1.3-0.9,2.7-1.3,4.3-1.3c2.9,0,5.2,1,6.7,2.9 c1.5,1.9,2.3,4.7,2.3,8.3v3.3c0,4.8-1.1,8.5-3.2,11c-2.1,2.5-5.3,3.8-9.4,3.9H46l0-1.1h0.8c3.8,0,6.7-1.2,8.7-3.5 C57.6,82.8,58.6,79.5,58.6,75.1z M50.4,79c1.9,0,3.6-0.6,5.1-1.7s2.5-2.6,3-4.5v-1.2c0-3.3-0.7-5.8-2-7.5c-1.4-1.7-3.3-2.6-5.8-2.6 c-1.4,0-2.7,0.4-3.8,1.2s-2,1.9-2.6,3.3c-0.6,1.4-0.9,2.9-0.9,4.5c0,1.5,0.3,3,0.9,4.3c0.6,1.3,1.5,2.4,2.5,3.1 C47.8,78.7,49.1,79,50.4,79z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M81.3,89.2h-17v-1.1L74,77c1.6-1.9,2.8-3.5,3.5-5c0.8-1.4,1.2-2.8,1.2-4c0-2.1-0.6-3.7-1.8-4.9 c-1.2-1.2-2.9-1.7-5.1-1.7c-1.3,0-2.5,0.3-3.6,1c-1.1,0.6-2,1.5-2.6,2.6c-0.6,1.1-0.9,2.4-0.9,3.8h-1.1c0-1.5,0.4-2.9,1.1-4.2 c0.7-1.3,1.7-2.3,2.9-3.1s2.6-1.1,4.2-1.1c2.5,0,4.5,0.7,5.9,2c1.4,1.3,2.1,3.2,2.1,5.6c0,2.2-1.2,4.9-3.7,7.9l-1.8,2.2l-8.6,10 h15.6V89.2z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M85.3,88.3c0-0.3,0.1-0.6,0.3-0.8c0.2-0.2,0.5-0.3,0.8-0.3c0.3,0,0.6,0.1,0.8,0.3s0.3,0.5,0.3,0.8 c0,0.3-0.1,0.6-0.3,0.8s-0.5,0.3-0.8,0.3c-0.3,0-0.6-0.1-0.8-0.3C85.4,88.8,85.3,88.6,85.3,88.3z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M92.7,74.3L94,60.8h13.9v1.1H95l-1.2,11.4c0.7-0.6,1.6-1,2.7-1.4s2.2-0.5,3.3-0.5c2.6,0,4.6,0.8,6.1,2.4 c1.5,1.6,2.3,3.8,2.3,6.4c0,3.1-0.7,5.4-2.1,7c-1.4,1.6-3.4,2.4-5.9,2.4c-2.4,0-4.4-0.7-5.9-2.1c-1.5-1.4-2.3-3.3-2.5-5.8h1.1 c0.2,2.2,0.9,3.9,2.2,5.1c1.2,1.2,3,1.7,5.2,1.7c2.3,0,4.1-0.7,5.2-2.1c1.1-1.4,1.7-3.5,1.7-6.2c0-2.4-0.7-4.3-2-5.7 c-1.3-1.4-3.1-2.1-5.3-2.1c-1.4,0-2.6,0.2-3.6,0.5c-1,0.4-1.9,0.9-2.7,1.7L92.7,74.3z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M113.8,74.3l1.3-13.6H129v1.1h-12.9l-1.2,11.4c0.7-0.6,1.6-1,2.7-1.4s2.2-0.5,3.3-0.5c2.6,0,4.6,0.8,6.1,2.4 c1.5,1.6,2.3,3.8,2.3,6.4c0,3.1-0.7,5.4-2.1,7c-1.4,1.6-3.4,2.4-5.9,2.4c-2.4,0-4.4-0.7-5.9-2.1c-1.5-1.4-2.3-3.3-2.5-5.8h1.1 c0.2,2.2,0.9,3.9,2.2,5.1c1.2,1.2,3,1.7,5.2,1.7c2.3,0,4.1-0.7,5.2-2.1c1.1-1.4,1.7-3.5,1.7-6.2c0-2.4-0.7-4.3-2-5.7 c-1.3-1.4-3.1-2.1-5.3-2.1c-1.4,0-2.6,0.2-3.6,0.5c-1,0.4-1.9,0.9-2.7,1.7L113.8,74.3z"
        />
      </svg>
    </div>
  ),
  bar: (
    <div className="graph-type-selector--graphic">
      <svg
        width="100%"
        height="100%"
        version="1.1"
        id="Bar"
        x="0px"
        y="0px"
        viewBox="0 0 150 150"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <rect
          x="2"
          y="108.4"
          className="graph-type-selector--graphic-line graphic-line-a"
          width="26.8"
          height="16.6"
        />
        <rect
          x="31.8"
          y="82.4"
          className="graph-type-selector--graphic-line graphic-line-b"
          width="26.8"
          height="42.6"
        />
        <rect
          x="61.6"
          y="28.8"
          className="graph-type-selector--graphic-line graphic-line-c"
          width="26.8"
          height="96.2"
        />
        <rect
          x="91.4"
          y="47.9"
          className="graph-type-selector--graphic-line graphic-line-a"
          width="26.8"
          height="77.1"
        />
        <rect
          x="121.2"
          y="25"
          className="graph-type-selector--graphic-line graphic-line-b"
          width="26.8"
          height="100"
        />
        <rect
          x="2"
          y="108.4"
          className="graph-type-selector--graphic-fill graphic-fill-a"
          width="26.8"
          height="16.6"
        />
        <rect
          x="31.8"
          y="82.4"
          className="graph-type-selector--graphic-fill graphic-fill-b"
          width="26.8"
          height="42.6"
        />
        <rect
          x="61.6"
          y="28.8"
          className="graph-type-selector--graphic-fill graphic-fill-c"
          width="26.8"
          height="96.2"
        />
        <rect
          x="91.4"
          y="47.9"
          className="graph-type-selector--graphic-fill graphic-fill-a"
          width="26.8"
          height="77.1"
        />
        <rect
          x="121.2"
          y="25"
          className="graph-type-selector--graphic-fill graphic-fill-b"
          width="26.8"
          height="100"
        />
      </svg>
    </div>
  ),
  gauge: (
    <div className="graph-type-selector--graphic">
      <svg
        width="100%"
        height="100%"
        version="1.1"
        id="Bar"
        x="0px"
        y="0px"
        viewBox="0 0 150 150"
        preserveAspectRatio="none meet"
        shapeRendering="geometricPrecision"
      >
        <g>
          <path
            className="graph-type-selector--graphic-line graphic-line-d"
            d="M110.9,110.9c19.9-19.9,19.9-52,0-71.9s-52-19.9-71.9,0s-19.9,52,0,71.9"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="39.1"
            y1="110.9"
            x2="35"
            y2="115"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="110.9"
            y1="110.9"
            x2="115"
            y2="115"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="122"
            y1="94.5"
            x2="127.2"
            y2="96.6"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="125.8"
            y1="75"
            x2="131.5"
            y2="75"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="122"
            y1="55.5"
            x2="127.2"
            y2="53.4"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="110.9"
            y1="39.1"
            x2="115"
            y2="35"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="94.5"
            y1="28"
            x2="96.6"
            y2="22.8"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="75"
            y1="24.2"
            x2="75"
            y2="18.5"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="55.5"
            y1="28"
            x2="53.4"
            y2="22.8"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="39.1"
            y1="39.1"
            x2="35"
            y2="35"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="28"
            y1="55.5"
            x2="22.8"
            y2="53.4"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="24.2"
            y1="75"
            x2="18.5"
            y2="75"
          />
          <line
            className="graph-type-selector--graphic-line graphic-line-d"
            x1="28"
            y1="94.5"
            x2="22.8"
            y2="96.6"
          />
        </g>
        <path
          className="graph-type-selector--graphic-fill graphic-fill-d"
          d="M78.6,73.4L75,56.3l-3.6,17.1c-0.2,0.5-0.3,1-0.3,1.6c0,2.2,1.8,3.9,3.9,3.9s3.9-1.8,3.9-3.9C78.9,74.4,78.8,73.9,78.6,73.4z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="M58.9,58.9c8.9-8.9,23.4-8.9,32.3,0l17.1-17.1c-18.4-18.4-48.2-18.4-66.5,0C32.5,50.9,27.9,63,27.9,75h24.2C52.2,69.2,54.4,63.3,58.9,58.9z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="M58.9,58.9c8.9-8.9,23.4-8.9,32.3,0l17.1-17.1c-18.4-18.4-48.2-18.4-66.5,0C32.5,50.9,27.9,63,27.9,75h24.2C52.2,69.2,54.4,63.3,58.9,58.9z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="M58.9,91.1c-4.5-4.5-6.7-10.3-6.7-16.1H27.9c0,12,4.6,24.1,13.8,33.3L58.9,91.1z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="M58.9,91.1c-4.5-4.5-6.7-10.3-6.7-16.1H27.9c0,12,4.6,24.1,13.8,33.3L58.9,91.1z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="M91.1,91.1l17.1,17.1c18.4-18.4,18.4-48.2,0-66.6L91.1,58.9C100.1,67.8,100.1,82.2,91.1,91.1z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="M91.1,91.1l17.1,17.1c18.4-18.4,18.4-48.2,0-66.6L91.1,58.9C100.1,67.8,100.1,82.2,91.1,91.1z"
        />
      </svg>
    </div>
  ),
  table: (
    <div className="graph-type-selector--graphic">
      <svg
        id="Table"
        x="0px"
        y="0px"
        width="100%"
        height="100%"
        viewBox="0 0 150 150"
      >
        <path
          className="graph-type-selector--graphic-fill graphic-fill-c"
          d="M55.5,115H19.7c-1.7,0-3.1-1.4-3.1-3.1V61.7h38.9V115z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="M133.4,61.7H55.5V35h74.8c1.7,0,3.1,1.4,3.1,3.1V61.7z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="M55.5,61.7H16.6V38.1c0-1.7,1.4-3.1,3.1-3.1h35.9V61.7z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-c"
          d="M16.6,88.3v23.6c0,1.7,1.4,3.1,3.1,3.1h35.9V88.3H16.6z"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-c"
          x="16.6"
          y="61.7"
          width="38.9"
          height="26.7"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="M94.5,35v26.7h38.9V38.1c0-1.7-1.4-3.1-3.1-3.1H94.5z"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-b"
          x="55.5"
          y="35"
          width="38.9"
          height="26.7"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-d"
          d="M94.5,115h35.9c1.7,0,3.1-1.4,3.1-3.1V88.3H94.5V115z"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-d"
          x="55.5"
          y="88.3"
          width="38.9"
          height="26.7"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-d"
          x="94.5"
          y="61.7"
          width="38.9"
          height="26.7"
        />
        <rect
          className="graph-type-selector--graphic-line graphic-line-d"
          x="55.5"
          y="61.7"
          width="38.9"
          height="26.7"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="M55.5,35H19.7c-1.7,0-3.1,1.4-3.1,3.1v23.6h38.9V35z"
        />
      </svg>
    </div>
  ),
  note: (
    <div className="graph-type-selector--graphic">
      <svg
        id="Note"
        x="0px"
        y="0px"
        width="100%"
        height="100%"
        viewBox="0 0 150 150"
      >
        <path
          className="graph-type-selector--graphic-fill graphic-fill-a"
          d="M61,97.3H37l-4.2,13.6H14l26.7-72.8h16.5l26.9,72.8H65.3L61,97.3z M41.2,83.8h15.7L49,58.5L41.2,83.8z"
        />
        <path
          className="graph-type-selector--graphic-fill graphic-fill-b"
          d="M119.1,110.9c-0.6-1.1-1.1-2.7-1.6-4.9c-3.1,3.9-7.4,5.9-13,5.9c-5.1,0-9.4-1.5-13-4.6c-3.6-3.1-5.4-7-5.4-11.6
	c0-5.9,2.2-10.3,6.5-13.3c4.3-3,10.6-4.5,18.9-4.5h5.2V75c0-5-2.2-7.5-6.5-7.5c-4,0-6,2-6,5.9H87.5c0-5.2,2.2-9.5,6.7-12.7
	c4.5-3.3,10.1-4.9,17-4.9c6.9,0,12.4,1.7,16.4,5.1c4,3.4,6.1,8,6.2,13.9v24c0.1,5,0.8,8.8,2.3,11.4v0.9H119.1z M108.6,99.9
	c2.1,0,3.8-0.5,5.2-1.4c1.4-0.9,2.4-1.9,3-3.1v-8.7h-4.9c-5.9,0-8.8,2.6-8.8,7.9c0,1.5,0.5,2.8,1.6,3.7
	C105.7,99.4,107,99.9,108.6,99.9z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-a"
          d="M61,97.3H37l-4.2,13.6H14l26.7-72.8h16.5l26.9,72.8H65.3L61,97.3z M41.2,83.8h15.7L49,58.5L41.2,83.8z"
        />
        <path
          className="graph-type-selector--graphic-line graphic-line-b"
          d="M119.1,110.9c-0.6-1.1-1.1-2.7-1.6-4.9c-3.1,3.9-7.4,5.9-13,5.9c-5.1,0-9.4-1.5-13-4.6c-3.6-3.1-5.4-7-5.4-11.6
	c0-5.9,2.2-10.3,6.5-13.3c4.3-3,10.6-4.5,18.9-4.5h5.2V75c0-5-2.2-7.5-6.5-7.5c-4,0-6,2-6,5.9H87.5c0-5.2,2.2-9.5,6.7-12.7
	c4.5-3.3,10.1-4.9,17-4.9c6.9,0,12.4,1.7,16.4,5.1c4,3.4,6.1,8,6.2,13.9v24c0.1,5,0.8,8.8,2.3,11.4v0.9H119.1z M108.6,99.9
	c2.1,0,3.8-0.5,5.2-1.4c1.4-0.9,2.4-1.9,3-3.1v-8.7h-4.9c-5.9,0-8.8,2.6-8.8,7.9c0,1.5,0.5,2.8,1.6,3.7
	C105.7,99.4,107,99.9,108.6,99.9z"
        />
      </svg>
    </div>
  ),
}

interface GraphType {
  type: CellType
  menuOption: string
  graphic: Graphic
}

export const COMMON_GRAPH_TYPES: GraphType[] = [
  {
    type: CellType.SingleStat,
    menuOption: 'Single Stat',
    graphic: GRAPH_SVGS[CellType.SingleStat],
  },
  {
    type: CellType.Gauge,
    menuOption: 'Gauge',
    graphic: GRAPH_SVGS[CellType.Gauge],
  },
  {
    type: CellType.Table,
    menuOption: 'Table',
    graphic: GRAPH_SVGS[CellType.Table],
  },
  {
    type: CellType.Note,
    menuOption: 'Note',
    graphic: GRAPH_SVGS[CellType.Note],
  },
]

export const GRAPH_TYPES: GraphType[] = [
  {
    type: CellType.Line,
    menuOption: 'Line',
    graphic: GRAPH_SVGS[CellType.Line],
  },
  {
    type: CellType.Stacked,
    menuOption: 'Stacked',
    graphic: GRAPH_SVGS[CellType.Stacked],
  },
  {
    type: CellType.StepPlot,
    menuOption: 'Step-Plot',
    graphic: GRAPH_SVGS[CellType.StepPlot],
  },
  {
    type: CellType.Bar,
    menuOption: 'Bar',
    graphic: GRAPH_SVGS[CellType.Bar],
  },
  {
    type: CellType.LinePlusSingleStat,
    menuOption: 'Line + Single Stat',
    graphic: GRAPH_SVGS[CellType.LinePlusSingleStat],
  },
]

export const STATISTICAL_GRAPH_TYPES: GraphType[] = [
  {
    type: CellType.Histogram,
    menuOption: 'Histogram',
    graphic: GRAPH_SVGS[CellType.Histogram],
  },
  {
    type: CellType.StaticStackedChart,
    menuOption: 'Stacked Histogram',
    graphic: GRAPH_SVGS[CellType.StaticStackedChart],
  },
  {
    type: CellType.StaticPie,
    menuOption: 'Pie',
    graphic: GRAPH_SVGS[CellType.StaticPie],
  },
  {
    type: CellType.StaticDoughnut,
    menuOption: 'Doughnut',
    graphic: GRAPH_SVGS[CellType.StaticDoughnut],
  },
  {
    type: CellType.StaticScatter,
    menuOption: 'Scatter',
    graphic: GRAPH_SVGS[CellType.StaticScatter],
  },
  {
    type: CellType.StaticRadar,
    menuOption: 'Radar',
    graphic: GRAPH_SVGS[CellType.StaticRadar],
  },
  {
    type: CellType.StaticLineChart,
    menuOption: 'Line',
    graphic: GRAPH_SVGS[CellType.StaticLineChart],
  },
]
