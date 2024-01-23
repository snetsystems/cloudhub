// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
// Components
import {Radio, ButtonShape} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import LineGraphColorSelector from 'src/shared/components/LineGraphColorSelector'
import GraphOptionsSortBy from 'src/dashboards/components/GraphOptionsSortBy'
import GraphOptionsCustomizeFields from 'src/dashboards/components/GraphOptionsCustomizeFields'

// Constants
import {STATISTICAL_GRAPH_TYPES} from 'src/dashboards/graphics/graph'
import {DEFAULT_STATISTICAL_TIME_FIELD} from 'src/dashboards/constants/'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Types
import {StaticLegendPositionType} from 'src/types/dashboards'
import {ColorString} from 'src/types/colors'

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
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  defaultYLabel: string
  lineColors: ColorString[]
  onToggleStaticLegend: (isStaticLegend: boolean) => void
  onToggleStaticLegendPosition: (
    staticLegendPosition: StaticLegendPositionType
  ) => void
  onUpdateLineColors: (colors: ColorString[]) => void
  onUpdateTableOptions: (options: TableOptionsInterface) => void
  onUpdateFieldOptions: (fieldOptions: RenamableField[]) => void
}

@ErrorHandling
class DoughnutPieChartOptions extends PureComponent<Props> {
  constructor(props) {
    super(props)

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

    const {menuOption} = STATISTICAL_GRAPH_TYPES.find(
      graph => graph.type === type
    )
    const tableSortByOptions = fieldOptions
      .map(field => ({
        key: field.internalName,
        text: field.displayName || field.internalName,
      }))
      .filter(field => field?.key !== 'time')
    const customizeFieldOptions = fieldOptions.filter(
      fieldOption => fieldOption?.internalName !== 'time'
    )
    const isValidSelectedSortField =
      tableOptions?.sortBy?.internalName !== 'time' &&
      tableOptions?.sortBy?.internalName !== '' &&
      tableSortByOptions.some(
        tableSortByOption =>
          tableSortByOption?.key === tableOptions?.sortBy?.internalName
      )

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
                  ? tableOptions.sortBy
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
              />
            </div>
            <LineGraphColorSelector
              onUpdateLineColors={onUpdateLineColors}
              lineColors={lineColors}
            />
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

  private moveField(dragIndex, hoverIndex) {
    const {onUpdateFieldOptions, fieldOptions} = this.props

    const dragIndexExcludingTime = dragIndex + 1
    const hoverIndexExcludingTime = hoverIndex + 1

    const draggedField = fieldOptions[dragIndexExcludingTime]

    const fieldOptionsRemoved = _.concat(
      _.slice(fieldOptions, 0, dragIndexExcludingTime),
      _.slice(fieldOptions, dragIndexExcludingTime + 1)
    )

    const fieldOptionsAdded = _.concat(
      _.slice(fieldOptionsRemoved, 0, hoverIndexExcludingTime),
      [draggedField],
      _.slice(fieldOptionsRemoved, hoverIndexExcludingTime)
    )

    onUpdateFieldOptions(fieldOptionsAdded)
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
}

export default DoughnutPieChartOptions
