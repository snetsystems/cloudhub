// Libraries
import React, {ChangeEvent, PureComponent} from 'react'

// Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import GraphOptionsDecimalPlaces from 'src/dashboards/components/GraphOptionsDecimalPlaces'
import GraphOptionsCustomizeFields from 'src/dashboards/components/GraphOptionsCustomizeFields'
import GraphOptionsSortBy from 'src/dashboards/components/GraphOptionsSortBy'
import GraphOptionsBooleanOption from 'src/dashboards/components/GraphOptionsBooleanOption'
import LineGraphColorSelector from 'src/shared/components/LineGraphColorSelector'
import Input from 'src/dashboards/components/DisplayOptionsInput'
import ThresholdListForOptions from 'src/dashboards/components/ThresholdListForOptions'


// Types
import {ErrorHandling} from 'src/shared/decorators/errors'
import {DecimalPlaces} from 'src/types/dashboards'
import {ColorNumber, ColorString} from 'src/types/colors'
import {
  RenamableField,
  TableGaugeChartOptionsInterface,
  TableOptionsInterface,
  DropdownOption,
  CHART_TYPE_MODES,
  BACKGROUND_TYPE_MODES,
  ColumnSettingInterface,
  FORMAT_OPTIONS,
  FormatOption,
} from 'src/types/statisticalgraph'

// Constants
import {DEFAULT_INFLUXQL_TIME_FIELD} from 'src/dashboards/constants'

// Utils
import {getDeep} from 'src/utils/wrappers'
import GraphOptionsToggleBtn from './GraphOptionsToggleBtn'
import { COLOR_TYPE_MAX } from 'src/shared/constants/thresholds'

interface Props {
  groupByTag: string[]
  fieldOptions: RenamableField[]
  tableOptions: TableOptionsInterface
  decimalPlaces: DecimalPlaces
  tableGaugeChartOptions: TableGaugeChartOptionsInterface

  onResetFocus: () => void
  onUpdateTableOptions: (options: TableOptionsInterface) => void
  onUpdateFieldOptions: (fieldOptions: RenamableField[]) => void
  onUpdateDecimalPlaces: (d: DecimalPlaces) => void
  onUpdateTableGaugeChartOptions: (
    options: TableGaugeChartOptionsInterface
  ) => void
}

interface State {
  yPrefix: string
  ySuffix: string
}

@ErrorHandling
class TableGaugeChartOptions extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      yPrefix: getDeep<string>(props, 'axes.y.prefix', ''),
      ySuffix: getDeep<string>(props, 'axes.y.suffix', ''),
    }
  }

  public componentDidMount() {
    const {tableGaugeChartOptions, onUpdateTableGaugeChartOptions} = this.props

    const tempColumnSettings = [...tableGaugeChartOptions.columnSettings]

    tempColumnSettings.forEach((setting,setIndex) => {

      if(setting.max !== undefined) {
        setting.thresholdColors.forEach((c,i) =>{
          if(c.type === COLOR_TYPE_MAX && c.value !== setting.max){

            tempColumnSettings[setIndex].thresholdColors[i].value = setting.max
          }              
        })
      }      
    })
    onUpdateTableGaugeChartOptions({
      ...tableGaugeChartOptions,
      columnSettings: tempColumnSettings,
    })
  }

  public render() {
    const {
      decimalPlaces,
      fieldOptions,
      tableOptions,
      tableGaugeChartOptions,
      onResetFocus,
    } = this.props

    const tableSortByOptions = fieldOptions
      .filter(field => field.internalName !== 'time')
      .map(field => ({
        key: field.internalName,
        text: field.displayName || field.internalName,
      }))

    const customizeFieldOptions = fieldOptions.filter(fieldOption => {
      if (fieldOption.internalName === 'time') {
        return false
      }
      return true
    })

    return (
      <FancyScrollbar className="display-options" autoHide={false}>
        <div className="display-options--wrapper gauge-controls">
          <h5 className="display-options--header">Table Controls</h5>
          <div className="form-group-wrapper column-controls">
            <GraphOptionsSortBy
              selected={tableOptions.sortBy || DEFAULT_INFLUXQL_TIME_FIELD}
              selectedDirection={tableOptions?.sortBy.direction || 'asc'} //direction 확인하기
              sortByOptions={tableSortByOptions}
              onChooseSortBy={this.handleChooseSortBy}
              onChooseSortByDirection={this.handleChooseSortByDirection}
            />
            <GraphOptionsDecimalPlaces
              digits={decimalPlaces.digits}
              isEnforced={decimalPlaces.isEnforced}
              onDecimalPlacesChange={this.handleDecimalPlacesChange}
            />

            <div className="form-group col-xs-12">
              <GraphOptionsCustomizeFields
                fields={customizeFieldOptions}
                onFieldUpdate={this.handleFieldUpdate}
                moveField={this.moveField}
                isUsingTempVar={true}
              />
            </div>
            <div className="graph-options-group"></div>
          </div>

          <h5 className="display-options--header">Column Gauge Controls</h5>
          <div className="form-group-wrapper column-settings">
            {tableGaugeChartOptions.columnSettings.map((setting, index) =>{
              if(fieldOptions.find(f => f.internalName === setting.internalName).visible === false){
                return null
              }
              return (
                <div
                className="form-group"
                key={`${setting.internalName}-${index}`}
              >
                <div className="form-group-wrapper-label-container">
                  <span className="form-group-wrapper-label">
                    {setting.displayName || setting.internalName}
                  </span>
                </div>
                <Input
                  name={`${setting.internalName}-prefix`}
                  id={`${setting.internalName}-prefix`}
                  value={setting.prefix ?? ''}
                  labelText={`prefix`}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    this.handleSetColumnValue('prefix', e.target.value, index)
                  }
                  colWidth="col-xs-6"
                />
                <Input
                  name="y-suffix"
                  id="y-suffix"
                  value={setting.suffix ?? ''}
                  labelText={`suffix`}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    this.handleSetColumnValue('suffix', e.target.value, index)
                  }
                  colWidth="col-xs-6"
                />
                <GraphOptionsBooleanOption
                  colWidth="col-xs-6"
                  title="Display Chart"
                  value={setting.isShowChart}
                  onToggleActive={(value: boolean) =>
                    this.handleToggleShowChart(value, index)
                  }
                  labelTextActive="Chart"
                  labelTextInactive="Value"
                />
                <GraphOptionsToggleBtn
                  title="Value's Format"
                  colWidth="col-xs-6"
                  GraphOptionsOptions={[
                    {
                      value: FORMAT_OPTIONS.RAW,
                      active: setting.valueFormat === FORMAT_OPTIONS.RAW,
                      onClick: () =>
                        this.handleToggleValueFormat(FORMAT_OPTIONS.RAW, index),
                      titleText: "Don't format values",
                      title: 'Raw',
                    },
                    {
                      value: FORMAT_OPTIONS.KMB,
                      active: setting.valueFormat === FORMAT_OPTIONS.KMB,
                      onClick: () =>
                        this.handleToggleValueFormat(FORMAT_OPTIONS.KMB, index),
                      titleText: 'Thousand / Million / Billion',
                      title: 'K/M/B',
                    },
                    {
                      value: FORMAT_OPTIONS.KMG,
                      active: setting.valueFormat === FORMAT_OPTIONS.KMG,
                      onClick: () =>
                        this.handleToggleValueFormat(FORMAT_OPTIONS.KMG, index),
                      titleText: 'Kilo / Mega / Giga',
                      title: 'K/M/G',
                    },
                  ]}
                />
                <GraphOptionsBooleanOption
                  colWidth="col-xs-6"
                  title="Display Values"
                  value={setting.isShowValues}
                  onToggleActive={(value: boolean) =>
                    this.handleToggleValues(value, index)
                  }
                  labelTextActive="Display"
                  labelTextInactive="Hide"
                  disabled={!setting.isShowChart}
                />
                <GraphOptionsBooleanOption
                  colWidth="col-xs-6"
                  title="Percent"
                  value={setting.isPercent}
                  onToggleActive={(value: boolean) =>
                    this.handleTogglePercent(value, index)
                  }
                  labelTextActive="Percent"
                  labelTextInactive="Raw Value"
                />

                <GraphOptionsBooleanOption
                  colWidth="col-xs-6"
                  title="Chart Type"
                  value={setting.chartType === CHART_TYPE_MODES.CONTINUOUS}
                  onToggleActive={(value: boolean) =>
                    this.handleToggleChartType(value, index)
                  }
                  labelTextActive="Continuous"
                  labelTextInactive="Segmented"
                  disabled={!setting.isShowChart}
                />
                <GraphOptionsBooleanOption
                  colWidth="col-xs-6"
                  title="Background Type"
                  value={
                    setting.backgroundType === BACKGROUND_TYPE_MODES.GRADIENT
                  }
                  onToggleActive={(value: boolean) =>
                    this.handleToggleBackgroundType(value, index)
                  }
                  labelTextActive="Gradient"
                  labelTextInactive="Solid"                  
                />
                {/* <div className="form-group col-sm-6">
                  <label htmlFor="min">Min</label>
                  <OptIn
                    customPlaceholder={'min'}
                    customValue={setting.min ? setting.min.toString() : ''}
                    onSetValue={(value: string) =>
                      this.handleSetColumnMinMax(value, index, 'min')
                    }
                    type="number"
                    min={getInputMin()}
                  />
                </div>
                <div className="form-group col-sm-6">
                  <label htmlFor="max">Max</label>
                  <OptIn
                    customPlaceholder="max"
                    customValue={setting.max ? setting.max.toString() : ''}
                    onSetValue={(value: string) =>
                      this.handleSetColumnMinMax(value, index, 'max')
                    }
                    type="number"
                    min={getInputMin()}
                  />
                </div> */}
                <Input
                  colWidth="col-xs-6"
                  name={`${setting.internalName}-min`}
                  id={`${setting.internalName}-min`}
                  value={`${setting.min ?? ''}`}
                  labelText={`min value`}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    this.handleSetColumnMinMax(e, index, 'min')
                  }
                />
                <Input
                  colWidth="col-xs-6"
                  name={`${setting.internalName}-max`}
                  id={`${setting.internalName}-max`}
                  value={`${setting.max ?? ''}`}
                  labelText={`max value`}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    this.handleSetColumnMinMax(e, index, 'max')
                  }
                />
                {setting.backgroundType === BACKGROUND_TYPE_MODES.GRADIENT ? (
                  <LineGraphColorSelector
                    onUpdateLineColors={(colors: ColorString[]) =>
                      this.handleUpdateLineColors(colors, index)
                    }
                    lineColors={setting.colors ?? []}
                  />
                ) : (
                  <div className="form-group col-xs-12">
                    <ThresholdListForOptions
                      gaugeColors={setting.thresholdColors ?? []}
                      onUpdateGaugeColors={(colors: ColorNumber[]) =>
                        this.handleUpdateGaugeColors(colors, index)
                      }
                      onResetFocus={onResetFocus}
                      maximum={setting.max}
                      minimum={setting.min}
                    />
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </div>
      </FancyScrollbar>
    )
  }

  private handleToggleValueFormat = (value: FormatOption, index: number) => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) => (i === index ? {...setting, valueFormat: value} : setting)
    )
    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }
    onUpdateTableGaugeChartOptions(setOptions)
  }

  private handleToggleBackgroundType = (value: boolean, index: number) => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) =>
        i === index
          ? {
              ...setting,
              backgroundType: value
                ? BACKGROUND_TYPE_MODES.GRADIENT
                : BACKGROUND_TYPE_MODES.SOLID,
            }
          : setting
    )
    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }

    onUpdateTableGaugeChartOptions(setOptions)
  }

  private handleSetColumnValue = (
    key: string,
    value: string,
    index: number
  ) => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) => (i === index ? {...setting, [key]: value} : setting)
    )
    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }
    onUpdateTableGaugeChartOptions(setOptions)
  }

  private handleToggleChartType = (value: boolean, index: number) => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) =>
        i === index
          ? {
              ...setting,
              chartType: value
                ? CHART_TYPE_MODES.CONTINUOUS
                : CHART_TYPE_MODES.SEGMENTED,
            }
          : setting
    )
    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }
    onUpdateTableGaugeChartOptions(setOptions)
  }

  private handleToggleShowChart = (value: boolean, index: number) => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) =>
        i === index
          ? {...setting, isShowChart: value, isShowValues: true}
          : setting
    )

    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }
    onUpdateTableGaugeChartOptions(setOptions)
  }

  private handleTogglePercent = (value: boolean, index: number) => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) => (i === index ? {...setting, isPercent: value} : setting)
    )

    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }
    onUpdateTableGaugeChartOptions(setOptions)
  }

  private handleSetColumnMinMax = (
    e: ChangeEvent<HTMLInputElement>,
    index: number,
    key: 'min' | 'max'
  ): void => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const value = e.target.value
    const numericLikePattern = /^-?\d*\.?\d*$/
    if (!numericLikePattern.test(value)) {
      return
    }

    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) =>
        i === index
          ? {
              ...setting,
              [key]: value === null ? undefined : value,
              thresholdColors: this.handleGaugeColors(
                tableGaugeChartOptions,
                key,
                value,
                index
              ),
            }
          : setting
    )

    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }

    onUpdateTableGaugeChartOptions(setOptions)
  }

  private handleGaugeColors = (
    options: TableGaugeChartOptionsInterface,
    key: 'min' | 'max',
    value: string,
    index: number
  ): ColorNumber[] => {
    const colors: ColorNumber[] = getDeep<ColorNumber[]>(
      options,
      `columnSettings[${index}].thresholdColors`,
      []
    )

    if (key === 'max') {
      return colors
    }

    const newColors = colors.map((color, idx) => {
      if (idx === 0) {
        return {
          ...color,
          value: parseFloat(value),
        }
      }
      return color
    })
    return newColors
  }

  private handleUpdateGaugeColors = (colors: ColorNumber[], index: number) => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) =>
        i === index ? {...setting, thresholdColors: colors} : setting
    )
    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }

    onUpdateTableGaugeChartOptions(setOptions)
  }

  private handleUpdateLineColors = (colors: ColorString[], index: number) => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) => (i === index ? {...setting, colors} : setting)
    )
    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }
    onUpdateTableGaugeChartOptions(setOptions)
  }

  private handleChooseSortBy = (option: DropdownOption) => {
    const {
      tableOptions,
      onUpdateTableOptions,
      fieldOptions,
      tableGaugeChartOptions,
      onUpdateTableGaugeChartOptions,
    } = this.props
    const sortBy = fieldOptions.find(f => f.internalName === option.key)
    const setOptions = {...tableOptions, sortBy}
    onUpdateTableOptions(setOptions)

    const targetSetting = tableGaugeChartOptions.columnSettings.find(
      setting => setting.internalName === option.key
    )
    const setGaugeChartOptions = {
      ...tableGaugeChartOptions,
      sortBy: targetSetting?.displayName || option.key,
      sortByDirection: 'asc' as 'asc' | 'desc',
    }

    onUpdateTableGaugeChartOptions(setGaugeChartOptions)
  }

  private handleChooseSortByDirection = (direction: 'asc' | 'desc') => {
    const {
      tableOptions,
      onUpdateTableOptions,
      fieldOptions,
      tableGaugeChartOptions,
      onUpdateTableGaugeChartOptions,
    } = this.props
    const sortBy = fieldOptions.find(
      f => f.internalName === tableOptions.sortBy.internalName
    )
    const updatedSortBy = {...sortBy, direction}

    const setOptions = {...tableOptions, sortBy: updatedSortBy}
    onUpdateTableOptions(setOptions)

    const setGaugeChartOptions = {
      ...tableGaugeChartOptions,
      sortByDirection: direction,
    }
    onUpdateTableGaugeChartOptions(setGaugeChartOptions)
  }

  private handleFieldUpdate = field => {
    const {
      onUpdateFieldOptions,
      fieldOptions,
      onUpdateTableGaugeChartOptions,
      tableGaugeChartOptions,
    } = this.props

    const updatedFieldOptions = fieldOptions.map(f =>
      f.internalName === field.internalName ? field : f
    )

    onUpdateFieldOptions(updatedFieldOptions)

    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: tableGaugeChartOptions.columnSettings.map(setting =>
        setting.internalName === field.internalName
          ? {...setting, displayName: field.displayName}
          : setting
      ),
    }

    onUpdateTableGaugeChartOptions(setOptions)
  }

  private filterExcludedFields(fieldOption) {
    if (fieldOption.internalName === 'time') {
      return false
    }
    return true
  }

  private findActualIndex(filteredFieldOptions, filteredIndex) {
    return getDeep(filteredFieldOptions, `[${filteredIndex}].originalIndex`, 0)
  }

  private moveField = (dragIndex: number, hoverIndex: number) => {
    const {
      onUpdateFieldOptions,
      fieldOptions,
      onUpdateTableGaugeChartOptions,
      tableGaugeChartOptions,
    } = this.props
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

    const reorderedColumnSettings = this.reorderColumnSettings(
      tableGaugeChartOptions?.columnSettings,
      newFieldOptions
    )

    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: reorderedColumnSettings,
    }

    onUpdateTableGaugeChartOptions(setOptions)
  }

  private reorderColumnSettings = (
    columnSettings: ColumnSettingInterface[] = [],
    orderedFields: RenamableField[] = []
  ): ColumnSettingInterface[] => {
    if (!columnSettings.length || !orderedFields.length) {
      return columnSettings
    }

    const settingMap = new Map(
      columnSettings.map(setting => [setting.internalName, setting])
    )

    const ordered: ColumnSettingInterface[] = []

    orderedFields.forEach(field => {
      const match = settingMap.get(field.internalName)
      if (match) {
        ordered.push(match)
        settingMap.delete(field.internalName)
      }
    })

    settingMap.forEach(setting => ordered.push(setting))

    return ordered
  }

  private handleDecimalPlacesChange = (decimalPlaces: DecimalPlaces) => {
    const {onUpdateDecimalPlaces} = this.props
    onUpdateDecimalPlaces(decimalPlaces)
  }

  private handleToggleValues = (isDisplay: boolean, index: number) => {
    const {onUpdateTableGaugeChartOptions, tableGaugeChartOptions} = this.props
    const updatedColumnSettings = tableGaugeChartOptions.columnSettings.map(
      (setting, i) =>
        i === index ? {...setting, isShowValues: isDisplay} : setting
    )
    const setOptions = {
      ...tableGaugeChartOptions,
      columnSettings: updatedColumnSettings,
    }

    onUpdateTableGaugeChartOptions(setOptions)
  }
}

export default TableGaugeChartOptions
