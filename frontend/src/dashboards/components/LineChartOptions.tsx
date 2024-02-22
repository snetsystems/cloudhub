// Libraries
import React, {PureComponent, ChangeEvent} from 'react'
import _ from 'lodash'
import {getDeep} from 'src/utils/wrappers'

// Components
import OptIn from 'src/shared/components/OptIn'
import Input from 'src/dashboards/components/DisplayOptionsInput'
import {Radio, ButtonShape} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LineGraphColorSelector from 'src/shared/components/LineGraphColorSelector'
import GraphOptionsSortBy from 'src/dashboards/components/GraphOptionsSortBy'
import GraphOptionsCustomizeFields from 'src/dashboards/components/GraphOptionsCustomizeFields'
import Dropdown from 'src/shared/components/Dropdown'

// Constants
import {AXES_SCALE_OPTIONS} from 'src/dashboards/constants/cellEditor'
import {STATISTICAL_GRAPH_TYPES} from 'src/dashboards/graphics/graph'
import {DEFAULT_STATISTICAL_TIME_FIELD} from 'src/dashboards/constants/'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Types
import {Axes, DropdownItem, Template} from 'src/types'
import {GraphOptions, StaticLegendPositionType} from 'src/types/dashboards'
import {ColorString} from 'src/types/colors'

const {LINEAR, LOG, BASE_2, BASE_10, BASE_RAW} = AXES_SCALE_OPTIONS
const getInputMin = () => (-Infinity).toString()

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
  groupByTag: string[]
  tableOptions: TableOptionsInterface
  fieldOptions: RenamableField[]
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
  onUpdateTableOptions: (options: TableOptionsInterface) => void
  onUpdateFieldOptions: (fieldOptions: RenamableField[]) => void
}

interface State {
  xPrefix: string
  xSuffix: string
  yPrefix: string
  ySuffix: string
}

@ErrorHandling
class LineChartOptions extends PureComponent<Props, State> {
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
    this.moveField = this.moveField.bind(this)
  }

  public render() {
    const {
      axes: {
        x: {label: xLabel},
        y: {bounds, label: yLabel},
      },
      groupByTag,
      type,
      lineColors,
      defaultXLabel,
      defaultYLabel,
      fieldOptions,
      tableOptions,
      onUpdateLineColors,
    } = this.props

    const {xPrefix, xSuffix, yPrefix, ySuffix} = this.state

    const [min, max] = bounds
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

    const selectedSortFieldByFirstField =
      _.get(
        _.find(fieldOptions, {internalName: defaultYLabel}),
        'displayName'
      ) || defaultYLabel
    const defaultStatisticalTimeField: RenamableField = {
      ...DEFAULT_STATISTICAL_TIME_FIELD,
      internalName:
        firstGroupByTag === undefined
          ? selectedSortFieldByFirstField
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
              <label htmlFor="min">Min</label>
              <OptIn
                customPlaceholder={'min'}
                customValue={min}
                onSetValue={this.handleSetYAxisBoundMin}
                type="number"
                min={getInputMin()}
              />
            </div>
            <div className="form-group col-sm-6">
              <label htmlFor="max">Max</label>
              <OptIn
                customPlaceholder="max"
                customValue={max}
                onSetValue={this.handleSetYAxisBoundMax}
                type="number"
                min={getInputMin()}
              />
            </div>
            {this.yValuesFormatTabs}
            {this.scaleTabs}
            {this.staticLegendTabs}
            {this.staticLegendPositionTabs}
            {this.chartAreaTabs}
            {this.chartLineTabs}
            {this.chartPointTabs}
            {this.showCount}
          </form>
        </div>
      </FancyScrollbar>
    )
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
    const selectedShowCount = this.getSelectedShowTemplateVariable()
    const showCountItems = this.getShowTemplateVariable()
    return (
      <div className="form-group col-sm-6">
        <label>Show Count </label>
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

  private get scaleTabs(): JSX.Element {
    const {
      axes: {
        y: {scale},
      },
    } = this.props

    return (
      <div className="form-group col-sm-6">
        <label>Scale</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="y-scale-tab--linear"
            value={LINEAR}
            active={scale === LINEAR || scale === ''}
            titleText="Set Y-Axis to Linear Scale"
            onClick={this.handleSetScale}
          >
            Linear
          </Radio.Button>
          <Radio.Button
            id="y-scale-tab--logarithmic"
            value={LOG}
            active={scale === LOG}
            titleText="Set Y-Axis to Logarithmic Scale"
            onClick={this.handleSetScale}
          >
            Logarithmic
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

  private handleSetScale = (scale: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, y: {...axes.y, scale}}

    onUpdateAxes(newAxes)
  }

  private handleSetBase = (base: string): void => {
    const {onUpdateAxes, axes} = this.props
    const newAxes = {...axes, y: {...axes.y, base}}

    onUpdateAxes(newAxes)
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

  private handleUpdateShowCount = (item: DropdownItem): void => {
    const {onUpdateGraphOptions, graphOptions} = this.props
    const newGraphOptions = {...graphOptions, showTempVarCount: item.text}

    onUpdateGraphOptions(newGraphOptions)
  }

  private handleUpdateFillArea = (fillArea: boolean): void => {
    const {onUpdateGraphOptions, graphOptions} = this.props
    const newGraphOptions = {...graphOptions, fillArea}

    onUpdateGraphOptions(newGraphOptions)
  }

  private get chartAreaTabs(): JSX.Element {
    const {graphOptions} = this.props
    const {fillArea} = graphOptions

    return (
      <div className="form-group col-sm-6">
        <label>Chart Area</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="chart-area--fill"
            value={true}
            active={fillArea === true}
            titleText="Fill Chart Area"
            onClick={this.handleUpdateFillArea}
          >
            Fill
          </Radio.Button>
          <Radio.Button
            id="chart-area--clear"
            value={false}
            active={fillArea === false}
            titleText="Clear Chart Area"
            onClick={this.handleUpdateFillArea}
          >
            Clear
          </Radio.Button>
        </Radio>
      </div>
    )
  }

  private handleUpdateShowLine = (showLine: boolean): void => {
    const {onUpdateGraphOptions, graphOptions} = this.props
    const newGraphOptions = {...graphOptions, showLine}

    onUpdateGraphOptions(newGraphOptions)
  }

  private get chartLineTabs(): JSX.Element {
    const {graphOptions} = this.props
    const {showLine} = graphOptions

    return (
      <div className="form-group col-sm-6">
        <label>Chart Line</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="chart-line--show"
            value={true}
            active={showLine === true}
            titleText="Show chart line"
            onClick={this.handleUpdateShowLine}
          >
            Show
          </Radio.Button>
          <Radio.Button
            id="chart-line--hide"
            value={false}
            active={showLine === false}
            titleText="Hide chart line"
            onClick={this.handleUpdateShowLine}
          >
            Hide
          </Radio.Button>
        </Radio>
      </div>
    )
  }

  private handleUpdateShowPoint = (showPoint: boolean): void => {
    const {onUpdateGraphOptions, graphOptions} = this.props
    const newGraphOptions = {...graphOptions, showPoint}

    onUpdateGraphOptions(newGraphOptions)
  }

  private get chartPointTabs(): JSX.Element {
    const {graphOptions} = this.props
    const {showPoint} = graphOptions

    return (
      <div className="form-group col-sm-6">
        <label>Chart Point</label>
        <Radio shape={ButtonShape.StretchToFit}>
          <Radio.Button
            id="chart-point--show"
            value={true}
            active={showPoint === true}
            titleText="Show chart point"
            onClick={this.handleUpdateShowPoint}
          >
            Show
          </Radio.Button>
          <Radio.Button
            id="chart-point--hide"
            value={false}
            active={showPoint === false}
            titleText="Hide chart point"
            onClick={this.handleUpdateShowPoint}
          >
            Hide
          </Radio.Button>
        </Radio>
      </div>
    )
  }
  private getSelectedShowTemplateVariable = () => {
    const {graphOptions} = this.props
    const selectedVariable =
      graphOptions?.showTempVarCount || 'Choose Template Variable'
    return selectedVariable
  }

  private getShowTemplateVariable = () => {
    const {dashboardTemplates} = this.props

    return _.reduce(
      dashboardTemplates,
      (acc: string[], template) => {
        if (template.type === 'text' && template.tempVar) {
          acc.push(template.tempVar)
        }
        return acc
      },
      []
    )
  }
}

export default LineChartOptions
