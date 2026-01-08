// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import GraphOptionsDecimalPlaces from 'src/dashboards/components/GraphOptionsDecimalPlaces'
import ThresholdList from 'src/dashboards/components/ThresholdList'

// Types
import {ErrorHandling} from 'src/shared/decorators/errors'
import {Axes} from 'src/types'
import {DecimalPlaces} from 'src/types/dashboards'
import {ColorNumber} from 'src/types/colors'

interface Props {
  axes: Axes
  gaugeColors: ColorNumber[]
  decimalPlaces: DecimalPlaces
  onResetFocus: () => void
  onUpdateAxes: (a: Axes) => void
  onUpdateDecimalPlaces: (d: DecimalPlaces) => void
  onUpdateGaugeColors: (g: ColorNumber[]) => void
}

@ErrorHandling
class GaugeOptions extends PureComponent<Props> {
  public render() {
    const {
      gaugeColors,
      axes,
      decimalPlaces,
      onUpdateGaugeColors,
      onResetFocus,
    } = this.props
    const {y} = axes

    return (
      <FancyScrollbar className="display-options" autoHide={false}>
        <div className="display-options--wrapper">
          <h5 className="display-options--header">Gauge Controls</h5>

          <ThresholdList
            gaugeColors={gaugeColors}
            onUpdateGaugeColors={onUpdateGaugeColors}
            onResetFocus={onResetFocus}
          />
          <div className="graph-options-group form-group-wrapper">
            <div className="form-group col-xs-6">
              <label>Prefix</label>
              <input
                className="form-control input-sm"
                placeholder="%, MPH, etc."
                defaultValue={y.prefix}
                onChange={this.handleUpdatePrefix}
              />
            </div>
            <div className="form-group col-xs-6">
              <label>Suffix</label>
              <input
                className="form-control input-sm"
                placeholder="%, MPH, etc."
                defaultValue={y.suffix}
                onChange={this.handleUpdateSuffix}
              />
            </div>
            <GraphOptionsDecimalPlaces
              digits={decimalPlaces.digits}
              isEnforced={decimalPlaces.isEnforced}
              onDecimalPlacesChange={this.handleDecimalPlacesChange}
            />
          </div>
        </div>
      </FancyScrollbar>
    )
  }

  private handleDecimalPlacesChange = (decimalPlaces: DecimalPlaces) => {
    const {onUpdateDecimalPlaces} = this.props
    onUpdateDecimalPlaces(decimalPlaces)
  }

  private handleUpdatePrefix = e => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, y: {...axes.y, prefix: e.target.value}}

    onUpdateAxes(newAxes)
  }

  private handleUpdateSuffix = e => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, y: {...axes.y, suffix: e.target.value}}

    onUpdateAxes(newAxes)
  }

  get sortedGaugeColors() {
    const {gaugeColors} = this.props
    const sortedColors = _.sortBy(gaugeColors, 'value')

    return sortedColors
  }
}

export default GaugeOptions
