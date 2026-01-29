// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import uuid from 'uuid'

// Components
import Threshold from 'src/dashboards/components/Threshold'

// Constants
import {
  COLOR_TYPE_THRESHOLD,
  MAX_THRESHOLDS,
  MIN_THRESHOLDS,
  THRESHOLD_COLORS,
} from 'src/shared/constants/thresholds'

// Types
import {ColorNumber} from 'src/types/colors'

interface Props {
  gaugeColors: ColorNumber[]
  onUpdateGaugeColors: (g: ColorNumber[]) => void
  onResetFocus: () => void
}

export default class ThresholdList extends PureComponent<Props> {
  public render() {
    const {gaugeColors} = this.props
    const isMax = gaugeColors.length - 1
    return (
      <div className="thresholds-list">
        <button
          className="btn btn-sm btn-primary"
          onClick={this.handleAddThreshold}
          disabled={this.disableAddThreshold}
        >
          <span className="icon plus" /> Add Threshold
        </button>
        {this.sortedGaugeColors.map((color, index) => {
          return (
            <Threshold
              isMin={index === 0}
              isMax={index === isMax}
              visualizationType="gauge"
              threshold={color}
              key={uuid.v4()}
              disableMaxColor={this.disableMaxColor}
              onChooseColor={this.handleChooseColor}
              onValidateColorValue={this.handleValidateColorValue}
              onUpdateColorValue={this.handleUpdateColorValue}
              onDeleteThreshold={this.handleDeleteThreshold}
            />
          )
        })}
      </div>
    )
  }

  private handleAddThreshold = () => {
    const {gaugeColors, onUpdateGaugeColors, onResetFocus} = this.props
    const sortedColors = _.sortBy(gaugeColors, color => color.value)

    if (sortedColors.length <= MAX_THRESHOLDS) {
      const randomColor = _.random(0, THRESHOLD_COLORS.length - 1)

      const maxValue = sortedColors[sortedColors.length - 1].value
      const minValue = sortedColors[0].value

      const colorsValues = _.mapValues(gaugeColors, 'value')
      let randomValue

      do {
        randomValue = _.round(_.random(minValue, maxValue, true), 2)
      } while (_.includes(colorsValues, randomValue))

      const newThreshold = {
        type: COLOR_TYPE_THRESHOLD,
        id: uuid.v4(),
        value: randomValue,
        hex: THRESHOLD_COLORS[randomColor].hex,
        name: THRESHOLD_COLORS[randomColor].name,
      }

      const updatedColors: ColorNumber[] = _.sortBy<ColorNumber>(
        [...gaugeColors, newThreshold],
        color => color.value
      )

      onUpdateGaugeColors(updatedColors)
    } else {
      onResetFocus()
    }
  }

  private get disableAddThreshold(): boolean {
    const {gaugeColors} = this.props
    return gaugeColors.length > MAX_THRESHOLDS
  }

  private get disableMaxColor(): boolean {
    const {gaugeColors} = this.props
    return gaugeColors.length > MIN_THRESHOLDS
  }

  private handleChooseColor = threshold => {
    const {onUpdateGaugeColors} = this.props
    const gaugeColors = this.props.gaugeColors.map(color =>
      color.id === threshold.id
        ? {...color, hex: threshold.hex, name: threshold.name}
        : color
    )

    onUpdateGaugeColors(gaugeColors)
  }

  private handleValidateColorValue = (threshold, targetValue) => {
    const {gaugeColors} = this.props

    const thresholdValue = threshold.value
    let allowedToUpdate = false

    const sortedColors = _.sortBy(gaugeColors, color => color.value)

    const minValue = sortedColors[0].value
    const maxValue = sortedColors[sortedColors.length - 1].value

    // If lowest value, make sure it is less than the next threshold
    if (thresholdValue === minValue) {
      const nextValue = sortedColors[1].value
      allowedToUpdate = targetValue < nextValue
    }
    // If highest value, make sure it is greater than the previous threshold
    if (thresholdValue === maxValue) {
      const previousValue = sortedColors[sortedColors.length - 2].value
      allowedToUpdate = previousValue < targetValue
    }
    // If not min or max, make sure new value is greater than min, less than max, and unique
    if (thresholdValue !== minValue && thresholdValue !== maxValue) {
      const greaterThanMin = targetValue > minValue
      const lessThanMax = targetValue < maxValue

      const colorsWithoutMinOrMax = sortedColors.slice(
        1,
        sortedColors.length - 1
      )

      const isUnique = !colorsWithoutMinOrMax.some(
        color => color.value === targetValue && color.id !== threshold.id
      )

      allowedToUpdate = greaterThanMin && lessThanMax && isUnique
    }

    return allowedToUpdate
  }

  private handleUpdateColorValue = (threshold, value) => {
    const {onUpdateGaugeColors} = this.props
    const gaugeColors = this.props.gaugeColors.map(color =>
      color.id === threshold.id ? {...color, value} : color
    )

    onUpdateGaugeColors(gaugeColors)
  }

  private handleDeleteThreshold = threshold => {
    const {onUpdateGaugeColors, onResetFocus} = this.props
    const gaugeColors = this.props.gaugeColors.filter(
      color => color.id !== threshold.id
    )
    const sortedColors = _.sortBy(gaugeColors, color => color.value)

    onUpdateGaugeColors(sortedColors)
    onResetFocus()
  }

  get sortedGaugeColors() {
    const {gaugeColors} = this.props

    const sortedColors = _.sortBy(gaugeColors, 'value')

    return sortedColors
  }
}
