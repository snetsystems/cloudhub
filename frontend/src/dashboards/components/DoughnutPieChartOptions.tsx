// Libraries
import React, {PureComponent, ChangeEvent} from 'react'
import _ from 'lodash'

// Components
import Input from 'src/dashboards/components/DisplayOptionsInput'
import {Radio, ButtonShape} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LineGraphColorSelector from 'src/shared/components/LineGraphColorSelector'
import GraphOptionsSortBy from 'src/dashboards/components/GraphOptionsSortBy'
import GraphOptionsCustomizeFields from 'src/dashboards/components/GraphOptionsCustomizeFields'

// Constants
import {AXES_SCALE_OPTIONS} from 'src/dashboards/constants/cellEditor'
import {STATISTICAL_GRAPH_TYPES} from 'src/dashboards/graphics/graph'
import {DEFAULT_STATISTICAL_TIME_FIELD} from 'src/dashboards/constants/'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Types
import {Axes} from 'src/types'
import {StaticLegendPositionType} from 'src/types/dashboards'
import {ColorString} from 'src/types/colors'
import {getDeep} from 'src/utils/wrappers'

const {LINEAR, BASE_2, BASE_10, BASE_RAW} = AXES_SCALE_OPTIONS

interface DropdownOption {
  text: string
  key: string
}

interface RenamableField {
  internalName: string
  displayName: string
  visible: boolean
  direction?: '' | 'asc' | 'desc'
}

interface TableOptionsInterface {
  verticalTimeAxis: boolean
  sortBy: RenamableField
  fixFirstColumn: boolean
}

interface Props {
  axes: Axes
  groupByTag: string[]
  tableOptions: TableOptionsInterface
  fieldOptions: RenamableField[]
  type: string
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  defaultYLabel: string
  lineColors: ColorString[]
  onUpdateAxes: (axes: Axes) => void
  onToggleStaticLegend: (isStaticLegend: boolean) => void
  onToggleStaticLegendPosition: (
    staticLegendPosition: StaticLegendPositionType
  ) => void
  onUpdateLineColors: (colors: ColorString[]) => void
  onUpdateTableOptions: (options: TableOptionsInterface) => void
  onUpdateFieldOptions: (fieldOptions: RenamableField[]) => void
}

interface State {
  valuePrefix: string
  valueSuffix: string
}

@ErrorHandling
class DoughnutPieChartOptions extends PureComponent<Props, State> {
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
      valuePrefix: getDeep<string>(props, 'axes.y.prefix', ''),
      valueSuffix: getDeep<string>(props, 'axes.y.suffix', ''),
    }
    this.moveField = this.moveField.bind(this)
  }

  public render() {
    const {
      groupByTag,
      type,
      lineColors,
      defaultYLabel,
      fieldOptions,
      tableOptions,
      onUpdateLineColors,
    } = this.props
    const {valuePrefix, valueSuffix} = this.state

    const {menuOption} = STATISTICAL_GRAPH_TYPES.find(
      graph => graph.type === type
    )
    const tableSortByOptions = fieldOptions
      .map(field => ({
        key: field.internalName,
        text: field.displayName || field.internalName,
      }))
      .filter(field => field?.key !== 'time')
    const customizeFieldOptions = fieldOptions.filter(fieldOption => {
      if (
        fieldOption.internalName === 'time' ||
        groupByTag.includes(fieldOption.internalName)
      ) {
        return false
      }
      return true
    })
    const isValidSelectedSortField =
      tableOptions?.sortBy?.internalName !== 'time' &&
      tableOptions?.sortBy?.internalName !== '' &&
      tableSortByOptions.some(
        tableSortByOption =>
          tableSortByOption?.key === tableOptions?.sortBy?.internalName
      )

    const selectedGraphOptionSortField = this.getSelectedGraphOptionSortField()
    const firstGroupByTag = groupByTag[0]
    const selectedSortFieldByFirstGroupBy =
      _.get(
        _.find(fieldOptions, {internalName: firstGroupByTag}),
        'displayName'
      ) || firstGroupByTag

    const selectedSortFieldByFristField =
      _.get(
        _.find(fieldOptions, {internalName: defaultYLabel}),
        'displayName'
      ) || defaultYLabel
    const defaultStatisticalTimeField: RenamableField = {
      ...DEFAULT_STATISTICAL_TIME_FIELD,
      internalName:
        firstGroupByTag === undefined
          ? selectedSortFieldByFristField
          : selectedSortFieldByFirstGroupBy,
    }

    return (
      <FancyScrollbar className="display-options" autoHide={false}>
        <div className="display-options--wrapper">
          <h5 className="display-options--header">{menuOption} Controls</h5>
          <form autoComplete="off" className="form-group-wrapper">
            <GraphOptionsSortBy
              selected={
                isValidSelectedSortField
                  ? selectedGraphOptionSortField
                  : defaultStatisticalTimeField
              }
              selectedDirection={tableOptions?.sortBy?.direction || 'asc'}
              sortByOptions={tableSortByOptions}
              onChooseSortBy={this.handleChooseSortBy}
              onChooseSortByDirection={this.handleChooseSortByDirection}
            />
            <div
              className="form-group col-xs-6"
              style={{width: '100%', marginBottom: '30px'}}
            >
              <GraphOptionsCustomizeFields
                fields={customizeFieldOptions}
                onFieldUpdate={this.handleFieldUpdate}
                moveField={this.moveField}
                isUsingTempVar={false}
              />
            </div>
            <Input
              name="prefix"
              id="prefix"
              value={valuePrefix}
              labelText="Value's Prefix"
              onChange={this.handleSetPieChartValuePrefix}
            />
            <Input
              name="suffix"
              id="suffix"
              value={valueSuffix}
              labelText="Value's Suffix"
              onChange={this.handleSetPieChartValueSuffix}
            />
            <LineGraphColorSelector
              onUpdateLineColors={onUpdateLineColors}
              lineColors={lineColors}
            />
            {this.valuesFormatTabs}
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

  private handleFieldUpdate = field => {
    const {
      onUpdateTableOptions,
      onUpdateFieldOptions,
      tableOptions,
      fieldOptions,
    } = this.props
    const {sortBy} = tableOptions

    const updatedFieldOptions = fieldOptions.map(f =>
      f.internalName === field.internalName ? field : f
    )

    if (sortBy.internalName === field.internalName) {
      const updatedSortBy = {...sortBy, displayName: field.displayName}
      onUpdateTableOptions({
        ...tableOptions,
        sortBy: updatedSortBy,
      })
    }

    onUpdateFieldOptions(updatedFieldOptions)
  }

  private filterExcludedFields(fieldOption) {
    const {groupByTag} = this.props

    if (
      fieldOption.internalName === 'time' ||
      groupByTag.includes(fieldOption?.internalName)
    ) {
      return false
    }
    return true
  }

  private findActualIndex(filteredFieldOptions, filteredIndex) {
    return _.get(filteredFieldOptions, `[${filteredIndex}].originalIndex`, 0)
  }

  private moveField(dragIndex, hoverIndex) {
    const {onUpdateFieldOptions, fieldOptions} = this.props

    const filteredFieldOptions = fieldOptions
      .map((field, index) => ({field, originalIndex: index}))
      .filter(item => this.filterExcludedFields(item.field))

    const actualDragIndex = this.findActualIndex(
      filteredFieldOptions,
      dragIndex
    )
    const actualHoverIndex = this.findActualIndex(
      filteredFieldOptions,
      hoverIndex
    )
    const draggedField = fieldOptions[actualDragIndex]
    let newFieldOptions = [...fieldOptions]

    newFieldOptions.splice(actualDragIndex, 1)
    newFieldOptions.splice(actualHoverIndex, 0, draggedField)

    onUpdateFieldOptions(newFieldOptions)
  }

  private handleChooseSortBy = (option: DropdownOption) => {
    const {tableOptions, onUpdateTableOptions, fieldOptions} = this.props
    const sortBy = fieldOptions.find(f => f.internalName === option.key)

    onUpdateTableOptions({...tableOptions, sortBy})
  }

  private handleChooseSortByDirection = (direction: 'asc' | 'desc') => {
    const {tableOptions, onUpdateTableOptions, fieldOptions} = this.props
    const sortBy = fieldOptions.find(
      f => f.internalName === tableOptions.sortBy.internalName
    )
    const updatedSortBy = {...sortBy, direction: direction}

    onUpdateTableOptions({...tableOptions, sortBy: updatedSortBy})
  }

  private getSelectedGraphOptionSortField(): RenamableField {
    const {fieldOptions, tableOptions} = this.props

    const matchedFieldOption = _.find(fieldOptions, {
      internalName: tableOptions?.sortBy?.internalName,
    })

    if (
      matchedFieldOption &&
      matchedFieldOption?.displayName !== tableOptions?.sortBy?.displayName
    ) {
      return matchedFieldOption
    }

    return tableOptions?.sortBy
  }

  private get valuesFormatTabs(): JSX.Element {
    const {
      axes: {
        y: {base},
      },
    } = this.props

    return (
      <div className="form-group col-sm-6">
        <label>Value's Format</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="values-format-tab--raw"
            value={BASE_RAW}
            active={base === '' || base === BASE_RAW}
            titleText="Don't format values"
            onClick={this.handleSetBase}
          >
            Raw
          </Radio.Button>
          <Radio.Button
            id="values-format-tab--kmb"
            value={BASE_10}
            active={base === BASE_10}
            titleText="Thousand / Million / Billion"
            onClick={this.handleSetBase}
          >
            K/M/B
          </Radio.Button>
          <Radio.Button
            id="values-format-tab--kmg"
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

  private handleSetBase = (base: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, y: {...axes.y, base}}

    onUpdateAxes(newAxes)
  }

  private handleSetPieChartValuePrefix = (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    const {onUpdateAxes, axes} = this.props
    const prefix = e.target.value

    const newAxes = {
      ...axes,
      y: {
        ...axes.y,
        prefix,
      },
    }

    this.setState({valuePrefix: prefix}, () => onUpdateAxes(newAxes))
  }

  private handleSetPieChartValueSuffix = (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    const {onUpdateAxes, axes} = this.props
    const suffix = e.target.value

    const newAxes = {
      ...axes,
      y: {
        ...axes.y,
        suffix,
      },
    }
    this.setState({valueSuffix: suffix}, () => onUpdateAxes(newAxes))
  }
}

export default DoughnutPieChartOptions
