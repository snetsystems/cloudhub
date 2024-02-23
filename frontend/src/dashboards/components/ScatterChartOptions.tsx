// Libraries
import React, {PureComponent, ChangeEvent} from 'react'
import {getDeep} from 'src/utils/wrappers'
import _ from 'lodash'

// Components
import OptIn from 'src/shared/components/OptIn'
import Input from 'src/dashboards/components/DisplayOptionsInput'
import {Radio, ButtonShape} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LineGraphColorSelector from 'src/shared/components/LineGraphColorSelector'
import Dropdown from 'src/shared/components/Dropdown'

// Constants
import {AXES_SCALE_OPTIONS} from 'src/dashboards/constants/cellEditor'
import {STATISTICAL_GRAPH_TYPES} from 'src/dashboards/graphics/graph'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Types
import {Axes, DropdownItem, Template} from 'src/types'
import {GraphOptions, StaticLegendPositionType} from 'src/types/dashboards'
import {ColorString} from 'src/types/colors'

// Utils
import {
  getSelectedShowTemplateVariable,
  getShowTemplateVariable,
} from 'src/shared/utils/staticGraph'

const {LINEAR, LOG, BASE_2, BASE_10, BASE_RAW} = AXES_SCALE_OPTIONS
const getInputMin = () => (-Infinity).toString()

interface Props {
  type: string
  axes: Axes
  graphOptions: GraphOptions
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  defaultXLabel: string
  defaultYLabel: string
  dashboardTemplates?: Template[]
  lineColors: ColorString[]
  onUpdateAxes: (axes: Axes) => void
  onUpdateGraphOptions: (graphOptions: GraphOptions) => void
  onToggleStaticLegend: (isStaticLegend: boolean) => void
  onToggleStaticLegendPosition: (
    staticLegendPosition: StaticLegendPositionType
  ) => void
  onUpdateLineColors: (colors: ColorString[]) => void
}

interface State {
  xPrefix: string
  xSuffix: string
  yPrefix: string
  ySuffix: string
}

@ErrorHandling
class ScatterChartOptions extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    axes: {
      y: {
        bounds: ['', ''],
        prefix: '',
        suffix: '',
        base: BASE_RAW,
        scale: LINEAR,
        label: '',
      },
      x: {
        bounds: ['', ''],
        prefix: '',
        suffix: '',
        base: BASE_RAW,
        scale: LINEAR,
        label: '',
      },
    },
  }
  constructor(props) {
    super(props)
    this.state = {
      xPrefix: getDeep<string>(props, 'axes.x.prefix', ''),
      xSuffix: getDeep<string>(props, 'axes.x.suffix', ''),
      yPrefix: getDeep<string>(props, 'axes.y.prefix', ''),
      ySuffix: getDeep<string>(props, 'axes.y.suffix', ''),
    }
  }

  public render() {
    const {
      axes: {
        x: {bounds: xBounds, label: xLabel},
        y: {bounds: yBounds, label: yLabel},
      },
      type,
      lineColors,
      defaultXLabel,
      defaultYLabel,
      onUpdateLineColors,
    } = this.props
    const {xPrefix, xSuffix, yPrefix, ySuffix} = this.state

    const [xMin, xMax] = xBounds
    const [yMin, yMax] = yBounds
    const {menuOption} = STATISTICAL_GRAPH_TYPES.find(
      graph => graph.type === type
    )

    return (
      <FancyScrollbar className="display-options" autoHide={false}>
        <div className="display-options--wrapper">
          <h5 className="display-options--header">{menuOption} Controls</h5>
          <form autoComplete="off" className="form-group-wrapper">
            <div className="form-group col-sm-12">
              <label>X-Axis Title</label>
              <OptIn
                type="text"
                customValue={xLabel}
                onSetValue={this.handleSetXAxisLabel}
                customPlaceholder={defaultXLabel || 'x-axis title'}
              />
            </div>
            <Input
              name="x-prefix"
              id="x-prefix"
              value={xPrefix}
              labelText="X-Value's Prefix"
              onChange={this.handleSetXAxisPrefix}
            />
            <Input
              name="x-suffix"
              id="x-suffix"
              value={xSuffix}
              labelText="X-Value's Suffix"
              onChange={this.handleSetXAxisSuffix}
            />
            <div className="form-group col-sm-12">
              <label>Y-Axis Title</label>
              <OptIn
                type="text"
                customValue={yLabel}
                onSetValue={this.handleSetYAxisLabel}
                customPlaceholder={defaultYLabel || 'y-axis title'}
              />
            </div>
            <Input
              name="y-prefix"
              id="y-prefix"
              value={yPrefix}
              labelText="Y-Value's Prefix"
              onChange={this.handleSetYAxisPrefix}
            />
            <Input
              name="y-suffix"
              id="y-suffix"
              value={ySuffix}
              labelText="Y-Value's Suffix"
              onChange={this.handleSetYAxisSuffix}
            />
            <LineGraphColorSelector
              onUpdateLineColors={onUpdateLineColors}
              lineColors={lineColors}
            />
            <div className="form-group col-sm-6">
              <label htmlFor="min">X-Value's Min</label>
              <OptIn
                customPlaceholder={'x value min'}
                customValue={xMin}
                onSetValue={this.handleSetXAxisBoundMin}
                type="number"
                min={getInputMin()}
              />
            </div>
            <div className="form-group col-sm-6">
              <label htmlFor="max">X-Value's Max</label>
              <OptIn
                customPlaceholder="x value max"
                customValue={xMax}
                onSetValue={this.handleSetXAxisBoundMax}
                type="number"
                min={getInputMin()}
              />
            </div>
            <div className="form-group col-sm-6">
              <label htmlFor="min">Y-Value's Min</label>
              <OptIn
                customPlaceholder={'y value min'}
                customValue={yMin}
                onSetValue={this.handleSetYAxisBoundMin}
                type="number"
                min={getInputMin()}
              />
            </div>
            <div className="form-group col-sm-6">
              <label htmlFor="max">Y-Value's Max</label>
              <OptIn
                customPlaceholder="y value max"
                customValue={yMax}
                onSetValue={this.handleSetYAxisBoundMax}
                type="number"
                min={getInputMin()}
              />
            </div>
            {this.xValuesFormatTabs}
            {this.yValuesFormatTabs}
            {this.xScaleTabs}
            {this.yScaleTabs}
            {this.staticLegendTabs}
            {this.staticLegendPositionTabs}
            {this.showCount}
          </form>
        </div>
      </FancyScrollbar>
    )
  }

  private get staticLegendTabs(): JSX.Element {
    const {staticLegend, onToggleStaticLegend} = this.props

    return (
      <div className="form-group col-sm-6">
        <label>Static Legend</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="static-legend-tab--show"
            value={true}
            active={staticLegend === true}
            titleText="Show static legend below graph"
            onClick={onToggleStaticLegend}
          >
            Show
          </Radio.Button>
          <Radio.Button
            id="static-legend-tab--hide"
            value={false}
            active={staticLegend === false}
            titleText="Hide static legend"
            onClick={onToggleStaticLegend}
          >
            Hide
          </Radio.Button>
        </Radio>
      </div>
    )
  }
  private get showCount(): JSX.Element {
    const {graphOptions, dashboardTemplates} = this.props
    const selectedShowCount = getSelectedShowTemplateVariable(graphOptions)
    const showCountItems = getShowTemplateVariable(dashboardTemplates)
    return (
      <div className="form-group col-sm-6">
        <label>Show Count</label>
        <div className="show-count-field">
          <Dropdown
            items={showCountItems}
            selected={selectedShowCount}
            buttonColor="btn-default"
            buttonSize="btn-sm"
            className="dropdown-stretch"
            onChoose={this.handleUpdateShowCount}
          />
        </div>
      </div>
    )
  }

  private get staticLegendPositionTabs(): JSX.Element {
    const {staticLegendPosition, onToggleStaticLegendPosition} = this.props

    return (
      <div className="form-group col-sm-6">
        <label>Static Legend Position</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="static-legend-tab--top"
            value={true}
            active={staticLegendPosition === 'top'}
            titleText="Show static legend on the top side"
            onClick={() => onToggleStaticLegendPosition('top')}
          >
            Top
          </Radio.Button>
          <Radio.Button
            id="static-legend-tab--bottom"
            value={false}
            active={staticLegendPosition === 'bottom'}
            titleText="Show static legend on the bottom side"
            onClick={() => onToggleStaticLegendPosition('bottom')}
          >
            Bottom
          </Radio.Button>
          <Radio.Button
            id="static-legend-tab--left"
            value={false}
            active={staticLegendPosition === 'left'}
            titleText="Show static legend on the left side"
            onClick={() => onToggleStaticLegendPosition('left')}
          >
            Left
          </Radio.Button>
          <Radio.Button
            id="static-legend-tab--right"
            value={false}
            active={staticLegendPosition === 'right'}
            titleText="Show static legend on the right side"
            onClick={() => onToggleStaticLegendPosition('right')}
          >
            Right
          </Radio.Button>
        </Radio>
      </div>
    )
  }

  private get xScaleTabs(): JSX.Element {
    const {
      axes: {
        y: {scale},
      },
    } = this.props

    return (
      <div className="form-group col-sm-6">
        <label>X-Value's Scale</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="x-scale-tab--linear"
            value={LINEAR}
            active={scale === LINEAR || scale === ''}
            titleText="Set X-Axis to Linear Scale"
            onClick={this.handleSetXScale}
          >
            Linear
          </Radio.Button>
          <Radio.Button
            id="x-scale-tab--logarithmic"
            value={LOG}
            active={scale === LOG}
            titleText="Set X-Axis to Logarithmic Scale"
            onClick={this.handleSetXScale}
          >
            Logarithmic
          </Radio.Button>
        </Radio>
      </div>
    )
  }

  private get yScaleTabs(): JSX.Element {
    const {
      axes: {
        y: {scale},
      },
    } = this.props

    return (
      <div className="form-group col-sm-6">
        <label>Y-Value's Scale</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="y-scale-tab--linear"
            value={LINEAR}
            active={scale === LINEAR || scale === ''}
            titleText="Set Y-Axis to Linear Scale"
            onClick={this.handleSetYScale}
          >
            Linear
          </Radio.Button>
          <Radio.Button
            id="y-scale-tab--logarithmic"
            value={LOG}
            active={scale === LOG}
            titleText="Set Y-Axis to Logarithmic Scale"
            onClick={this.handleSetYScale}
          >
            Logarithmic
          </Radio.Button>
        </Radio>
      </div>
    )
  }

  private get xValuesFormatTabs(): JSX.Element {
    const {
      axes: {
        x: {base},
      },
    } = this.props

    return (
      <div className="form-group col-sm-6">
        <label>X-Value's Format</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="x-values-format-tab--raw"
            value={BASE_RAW}
            active={base === '' || base === BASE_RAW}
            titleText="Don't format values"
            onClick={this.handleSetXBase}
          >
            Raw
          </Radio.Button>
          <Radio.Button
            id="x-values-format-tab--kmb"
            value={BASE_10}
            active={base === BASE_10}
            titleText="Thousand / Million / Billion"
            onClick={this.handleSetXBase}
          >
            K/M/B
          </Radio.Button>
          <Radio.Button
            id="x-values-format-tab--kmg"
            value={BASE_2}
            active={base === BASE_2}
            titleText="Kilo / Mega / Giga"
            onClick={this.handleSetXBase}
          >
            K/M/G
          </Radio.Button>
        </Radio>
      </div>
    )
  }

  private get yValuesFormatTabs(): JSX.Element {
    const {
      axes: {
        y: {base},
      },
    } = this.props

    return (
      <div className="form-group col-sm-6">
        <label>Y-Value's Format</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="y-values-format-tab--raw"
            value={BASE_RAW}
            active={base === '' || base === BASE_RAW}
            titleText="Don't format values"
            onClick={this.handleSetYBase}
          >
            Raw
          </Radio.Button>
          <Radio.Button
            id="y-values-format-tab--kmb"
            value={BASE_10}
            active={base === BASE_10}
            titleText="Thousand / Million / Billion"
            onClick={this.handleSetYBase}
          >
            K/M/B
          </Radio.Button>
          <Radio.Button
            id="y-values-format-tab--kmg"
            value={BASE_2}
            active={base === BASE_2}
            titleText="Kilo / Mega / Giga"
            onClick={this.handleSetYBase}
          >
            K/M/G
          </Radio.Button>
        </Radio>
      </div>
    )
  }

  private handleSetXAxisPrefix = (e: ChangeEvent<HTMLInputElement>): void => {
    const {onUpdateAxes, axes} = this.props
    const prefix = e.target.value

    const newAxes = {
      ...axes,
      x: {
        ...axes.x,
        prefix,
      },
    }

    this.setState({xPrefix: prefix}, () => onUpdateAxes(newAxes))
  }

  private handleSetYAxisPrefix = (e: ChangeEvent<HTMLInputElement>): void => {
    const {onUpdateAxes, axes} = this.props
    const prefix = e.target.value

    const newAxes = {
      ...axes,
      y: {
        ...axes.y,
        prefix,
      },
    }

    this.setState({yPrefix: prefix}, () => onUpdateAxes(newAxes))
  }

  private handleSetXAxisSuffix = (e: ChangeEvent<HTMLInputElement>): void => {
    const {onUpdateAxes, axes} = this.props
    const suffix = e.target.value

    const newAxes = {
      ...axes,
      x: {
        ...axes.x,
        suffix,
      },
    }
    this.setState({xSuffix: suffix}, () => onUpdateAxes(newAxes))
  }

  private handleSetYAxisSuffix = (e: ChangeEvent<HTMLInputElement>): void => {
    const {onUpdateAxes, axes} = this.props
    const suffix = e.target.value

    const newAxes = {
      ...axes,
      y: {
        ...axes.y,
        suffix,
      },
    }
    this.setState({ySuffix: suffix}, () => onUpdateAxes(newAxes))
  }

  private handleSetXAxisBoundMin = (min: string): void => {
    const {onUpdateAxes, axes} = this.props
    const {
      x: {
        bounds: [, max],
      },
    } = this.props.axes

    const bounds: [string, string] = [min, max]
    const newAxes = {...axes, x: {...axes.x, bounds}}

    onUpdateAxes(newAxes)
  }

  private handleSetXAxisBoundMax = (max: string): void => {
    const {onUpdateAxes, axes} = this.props
    const {
      x: {
        bounds: [min],
      },
    } = axes

    const bounds: [string, string] = [min, max]
    const newAxes = {...axes, x: {...axes.x, bounds}}

    onUpdateAxes(newAxes)
  }

  private handleSetYAxisBoundMin = (min: string): void => {
    const {onUpdateAxes, axes} = this.props
    const {
      y: {
        bounds: [, max],
      },
    } = this.props.axes

    const bounds: [string, string] = [min, max]
    const newAxes = {...axes, y: {...axes.y, bounds}}

    onUpdateAxes(newAxes)
  }

  private handleSetYAxisBoundMax = (max: string): void => {
    const {onUpdateAxes, axes} = this.props
    const {
      y: {
        bounds: [min],
      },
    } = axes

    const bounds: [string, string] = [min, max]
    const newAxes = {...axes, y: {...axes.y, bounds}}

    onUpdateAxes(newAxes)
  }

  private handleSetXAxisLabel = (label: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, x: {...axes.x, label}}

    onUpdateAxes(newAxes)
  }

  private handleSetYAxisLabel = (label: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, y: {...axes.y, label}}

    onUpdateAxes(newAxes)
  }

  private handleSetXScale = (scale: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, x: {...axes.x, scale}}

    onUpdateAxes(newAxes)
  }

  private handleSetYScale = (scale: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, y: {...axes.y, scale}}

    onUpdateAxes(newAxes)
  }

  private handleSetXBase = (base: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, x: {...axes.x, base}}

    onUpdateAxes(newAxes)
  }

  private handleSetYBase = (base: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, y: {...axes.y, base}}

    onUpdateAxes(newAxes)
  }

  private handleUpdateShowCount = (item: DropdownItem): void => {
    const {onUpdateGraphOptions, graphOptions} = this.props
    const newGraphOptions = {...graphOptions, showTempVarCount: item.text}

    onUpdateGraphOptions(newGraphOptions)
  }
}

export default ScatterChartOptions
