// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import uuid from 'uuid'

// Components
import Threshold from 'src/dashboards/components/Threshold'

// Constants
import {
  COLOR_TYPE_MAX,
  COLOR_TYPE_MIN,
  COLOR_TYPE_THRESHOLD,
  MAX_THRESHOLDS,
  THRESHOLD_COLORS,
} from 'src/shared/constants/thresholds'

// Types
import {ColorNumber} from 'src/types/colors'

interface Props {
  gaugeColors: ColorNumber[]
  onUpdateGaugeColors: (g: ColorNumber[]) => void
  onResetFocus: () => void
  maximum?: number
  minimum?: number
}

export default class ThresholdListForOptions extends PureComponent<Props> {
  public componentDidUpdate(prevProps: Props) {
    if (
      prevProps.maximum !== this.props.maximum ||
      prevProps.gaugeColors !== this.props.gaugeColors
    ) {
      console.log('maximum changed', this.props.gaugeColors)
    }
  }

  public render() {
    const {maximum, minimum} = this.props

    return (
      <div className="thresholds-list">
        <button
          className="btn btn-sm btn-primary"
          onClick={this.handleAddThreshold}
          disabled={this.disableAddThreshold}
        >
          <span className="icon plus" /> Add Threshold
        </button>
        {minimum != null && (
          <Threshold
            isMin={true}
            isMax={false}
            visualizationType="gauge"
            threshold={this.minThreshold}
            key="__ghost_minimum__"
            disableMaxColor={false}
            onChooseColor={this.handleMinColorChange}
            onValidateColorValue={this.handleNoOpValidate}
            onUpdateColorValue={this.handleNoOp}
            onDeleteThreshold={this.handleNoOp}
            readOnly={true}
          />
        )}
        {this.sortedGaugeColors.map(color => (
          <Threshold
            isMin={false}
            isMax={false}
            visualizationType="gauge"
            threshold={color}
            key={color.id}
            disableMaxColor={false}
            onChooseColor={this.handleChooseColor}
            onValidateColorValue={this.handleValidateColorValue}
            onUpdateColorValue={this.handleUpdateColorValue}
            onDeleteThreshold={this.handleDeleteThreshold}
            isInvalid={
              (maximum != null && color.value > maximum) ||
              (minimum != null && color.value < minimum)
            }
          />
        ))}
        {maximum != null && (
          <Threshold
            isMin={false}
            isMax={true}
            visualizationType="gauge"
            threshold={{
              type: COLOR_TYPE_MAX,
              hex: '#545667',
              id: '__ghost_maximum__',
              name: 'graphite',
              value: Number(maximum),
            }}
            key="__ghost_maximum__"
            disableMaxColor={true}
            onChooseColor={this.handleNoOp}
            onValidateColorValue={this.handleNoOpValidate}
            onUpdateColorValue={this.handleNoOp}
            onDeleteThreshold={this.handleNoOp}
            readOnly={true}
          />
        )}
      </div>
    )
  }

  private handleAddThreshold = () => {
    const {
      gaugeColors,
      onUpdateGaugeColors,
      onResetFocus,
      maximum,
      minimum,
    } = this.props

    const minValue = minimum != null ? Number(minimum) : null
    const maxValue = maximum != null ? Number(maximum) : null

    if (minValue == null || maxValue == null || minValue >= maxValue) {
      return
    }

    if (gaugeColors.length > MAX_THRESHOLDS) {
      onResetFocus()
      return
    }

    const randomColor = _.random(0, THRESHOLD_COLORS.length - 1)
    const colorsValues = _.map(gaugeColors, 'value')
    let randomValue
    let attempts = 0
    const maxAttempts = 1000
    do {
      randomValue = _.round(_.random(minValue, maxValue, true), 2)
      attempts++
      if (attempts >= maxAttempts) {
        const midValue = (minValue + maxValue) / 2
        const offset = gaugeColors.length * 0.01
        randomValue = _.round(midValue + offset, 2)
        if (!_.includes(colorsValues, randomValue)) {
          break
        }
        randomValue = _.round((minValue + maxValue) / 2, 2)
        break
      }
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
  }

  private get disableAddThreshold(): boolean {
    const {gaugeColors, maximum, minimum} = this.props

    if (gaugeColors.length > MAX_THRESHOLDS) {
      return true
    }

    const minValue = minimum != null ? Number(minimum) : null
    const maxValue = maximum != null ? Number(maximum) : null

    if (minValue == null || maxValue == null) {
      return true
    }

    if (minValue > maxValue) {
      return true
    }

    if (gaugeColors.length === 0) {
      return false
    }

    const colorsValues = _.map(gaugeColors, 'value')
    const availableRange = maxValue - minValue
    const uniqueValues = _.uniq(colorsValues).length

    const possibleValues = Math.floor(availableRange * 100) + 1
    if (uniqueValues >= possibleValues) {
      return true
    }

    return false
  }

  private get minThreshold(): ColorNumber {
    const {gaugeColors, minimum} = this.props
    const minItem = gaugeColors.find(c => c.type === COLOR_TYPE_MIN)
    if (minItem) {
      return {...minItem, value: Number(minimum)}
    }
    return {
      type: COLOR_TYPE_MIN,
      hex: '#545667',
      id: '__ghost_minimum__',
      name: 'graphite',
      value: Number(minimum),
    }
  }

  private handleMinColorChange = (threshold: ColorNumber) => {
    const {gaugeColors, onUpdateGaugeColors} = this.props
    const exists = gaugeColors.some(c => c.type === COLOR_TYPE_MIN)

    if (exists) {
      const updated = gaugeColors.map(c =>
        c.type === COLOR_TYPE_MIN
          ? {...c, hex: threshold.hex, name: threshold.name}
          : c
      )
      onUpdateGaugeColors(updated)
    } else {
      onUpdateGaugeColors([
        {...this.minThreshold, hex: threshold.hex, name: threshold.name},
        ...gaugeColors,
      ])
    }
  }

  private handleNoOp = () => {}
  private handleNoOpValidate = () => true

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

    // Only check uniqueness - sorting happens automatically on re-render
    const isUnique = !gaugeColors.some(
      color => color.value === targetValue && color.id !== threshold.id
    )

    return isUnique
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

    const thresholdColors = gaugeColors.filter(
      c => c.type !== COLOR_TYPE_MIN && c.type !== COLOR_TYPE_MAX
    )

    return _.sortBy(thresholdColors, 'value')
  }
}
