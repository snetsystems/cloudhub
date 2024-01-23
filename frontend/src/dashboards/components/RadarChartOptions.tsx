// Libraries
import React, {PureComponent, ChangeEvent} from 'react'
import {getDeep} from 'src/utils/wrappers'

// Components
import Input from 'src/dashboards/components/DisplayOptionsInput'
import OptIn from 'src/shared/components/OptIn'
import {Radio, ButtonShape} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LineGraphColorSelector from 'src/shared/components/LineGraphColorSelector'

// Constants
import {AXES_SCALE_OPTIONS} from 'src/dashboards/constants/cellEditor'
import {STATISTICAL_GRAPH_TYPES} from 'src/dashboards/graphics/graph'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Types
import {Axes} from 'src/types'
import {StaticLegendPositionType} from 'src/types/dashboards'
import {ColorString} from 'src/types/colors'

const {LINEAR, BASE_2, BASE_10, BASE_RAW} = AXES_SCALE_OPTIONS
const getInputMin = () => (-Infinity).toString()

interface Props {
  type: string
  axes: Axes
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  lineColors: ColorString[]
  onUpdateAxes: (axes: Axes) => void
  onToggleStaticLegend: (isStaticLegend: boolean) => void
  onToggleStaticLegendPosition: (
    staticLegendPosition: StaticLegendPositionType
  ) => void
  onUpdateLineColors: (colors: ColorString[]) => void
}

interface State {
  rPrefix: string
  rSuffix: string
}

@ErrorHandling
class RadarChartOptions extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    axes: {
      y: {
        bounds: ['', ''],
        prefix: '',
        suffix: '',
        base: BASE_10,
        scale: LINEAR,
        label: '',
      },
      x: {
        bounds: ['', ''],
        prefix: '',
        suffix: '',
        base: BASE_10,
        scale: LINEAR,
        label: '',
      },
    },
  }
  constructor(props) {
    super(props)
    this.state = {
      rPrefix: getDeep<string>(props, 'axes.y.prefix', ''),
      rSuffix: getDeep<string>(props, 'axes.y.suffix', ''),
    }
  }

  public render() {
    const {
      axes: {
        y: {bounds},
      },
      type,
      lineColors,

      onUpdateLineColors,
    } = this.props
    const {rPrefix, rSuffix} = this.state

    const [min, max] = bounds
    const {menuOption} = STATISTICAL_GRAPH_TYPES.find(
      graph => graph.type === type
    )

    return (
      <FancyScrollbar className="display-options" autoHide={false}>
        <div className="display-options--wrapper">
          <h5 className="display-options--header">{menuOption} Controls</h5>
          <form autoComplete="off" className="form-group-wrapper">
            <Input
              name="r-prefix"
              id="r-prefix"
              value={rPrefix}
              labelText="R-Value's Prefix"
              onChange={this.handleSetRAxisPrefix}
            />
            <Input
              name="r-suffix"
              id="r-suffix"
              value={rSuffix}
              labelText="R-Value's Suffix"
              onChange={this.handleSetRAxisSuffix}
            />
            <LineGraphColorSelector
              onUpdateLineColors={onUpdateLineColors}
              lineColors={lineColors}
            />
            <div className="form-group col-sm-6">
              <label htmlFor="min">Min</label>
              <OptIn
                customPlaceholder={'min'}
                customValue={min}
                onSetValue={this.handleSetRAxisBoundMin}
                type="number"
                min={getInputMin()}
              />
            </div>
            <div className="form-group col-sm-6">
              <label htmlFor="max">Max</label>
              <OptIn
                customPlaceholder="max"
                customValue={max}
                onSetValue={this.handleSetRAxisBoundMax}
                type="number"
                min={getInputMin()}
              />
            </div>
            {this.yValuesFormatTabs}

            {this.staticLegendTabs}
            {this.staticLegendPositionTabs}
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
            onClick={this.handleSetBase}
          >
            Raw
          </Radio.Button>
          <Radio.Button
            id="y-values-format-tab--kmb"
            value={BASE_10}
            active={base === BASE_10}
            titleText="Thousand / Million / Billion"
            onClick={this.handleSetBase}
          >
            K/M/B
          </Radio.Button>
          <Radio.Button
            id="y-values-format-tab--kmg"
            value={BASE_2}
            active={base === BASE_2}
            titleText="Kilo / Mega / Giga"
            onClick={this.handleSetBase}
          >
            K/M/G
          </Radio.Button>
        </Radio>
      </div>
    )
  }
  private handleSetRAxisPrefix = (e: ChangeEvent<HTMLInputElement>): void => {
    const {onUpdateAxes, axes} = this.props
    const rPrefix = e.target.value

    const newAxes = {
      ...axes,
      y: {
        ...axes.y,
        rPrefix,
      },
    }

    this.setState({rPrefix: rPrefix}, () => onUpdateAxes(newAxes))
  }

  private handleSetRAxisSuffix = (e: ChangeEvent<HTMLInputElement>): void => {
    const {onUpdateAxes, axes} = this.props
    const rSuffix = e.target.value

    const newAxes = {
      ...axes,
      y: {
        ...axes.y,
        rSuffix,
      },
    }
    this.setState({rSuffix: rSuffix}, () => onUpdateAxes(newAxes))
  }

  private handleSetRAxisBoundMin = (min: string): void => {
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

  private handleSetRAxisBoundMax = (max: string): void => {
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

  private handleSetBase = (base: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, y: {...axes.y, base}}

    onUpdateAxes(newAxes)
  }
}

export default RadarChartOptions
