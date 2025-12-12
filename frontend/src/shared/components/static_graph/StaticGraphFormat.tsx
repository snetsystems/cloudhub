// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Utils
import {
  ErrorTypes,
  getInvalidDataMessage,
  getDefaultTimeField,
} from 'src/dashboards/utils/tableGraph'

// Components
import InvalidData from 'src/shared/components/InvalidData'
import {
  constructCells,
  constructResults,
  constructSerieses,
} from 'src/shared/components/static_graph/StaticGraphTransform'

// Constants
import {DataType, DEFAULT_COLUMN_SETTING} from 'src/shared/constants'

// Types
import {
  TimeSeriesServerResponse,
  Label,
  InfluxQLQueryType,
} from 'src/types/series'
import {FieldOption} from 'src/types/dashboards'
import {
  ColumnSettingInterface,
  TableGaugeChartOptionsInterface,
} from 'src/types/statisticalgraph'

interface FormatProperties {
  fieldOptions: FieldOption[]
  tableGaugeChartOptions: TableGaugeChartOptionsInterface
  uuid: string
}

const areFormatPropertiesEqual = (
  prevProperties: FormatProperties,
  newProperties: FormatProperties
) => {
  const formatProps = ['uuid', 'fieldOptions', 'tableGaugeChartOptions']
  const areEqual = formatProps.every(k =>
    _.isEqual(prevProperties[k], newProperties[k])
  )
  return areEqual
}

interface Props {
  data: TimeSeriesServerResponse[]
  dataType: DataType
  fieldOptions: FieldOption[]
  tableGaugeChartOptions: TableGaugeChartOptionsInterface
  uuid: string
  children: (
    computedFieldOptions: FieldOption[],
    tableGaugeChartOptions: TableGaugeChartOptionsInterface
  ) => JSX.Element
}

interface State {
  computedFieldOptions: FieldOption[]
  invalidDataError: ErrorTypes
  tableGaugeChartOptions: TableGaugeChartOptionsInterface
}

class StaticGraphFormat extends PureComponent<Props, State> {
  private isComponentMounted: boolean

  constructor(props: Props) {
    super(props)

    this.state = {
      computedFieldOptions: props.fieldOptions,
      tableGaugeChartOptions: props.tableGaugeChartOptions,
      invalidDataError: null,
    }
  }

  public render() {
    if (this.state.invalidDataError) {
      return (
        <InvalidData
          message={getInvalidDataMessage(this.state.invalidDataError)}
        />
      )
    }

    return this.props.children(
      this.state.computedFieldOptions,
      this.state.tableGaugeChartOptions
    )
  }

  public componentDidMount() {
    this.isComponentMounted = true

    this.formatStaticGraphData()
  }

  public componentWillUnmount() {
    this.isComponentMounted = false
  }

  public componentDidUpdate(prevProps: Props) {
    if (!areFormatPropertiesEqual(prevProps, this.props)) {
      this.formatStaticGraphData()
    }
  }

  private formatStaticGraphData = async () => {
    const computedFieldOptions = this.makeStaticGraphFieldOptions()
    const tableGaugeChartOptions = this.makeTableGaugeChartOptions()
    try {
      if (!this.isComponentMounted) {
        return
      }

      this.setState({
        computedFieldOptions,
        invalidDataError: null,
        tableGaugeChartOptions,
      })
    } catch (err) {
      if (!this.isComponentMounted) {
        return
      }
      console.error(err)

      this.setState({invalidDataError: ErrorTypes.GeneralError})
    }
  }

  private makeStaticGraphFieldOptions = (): FieldOption[] => {
    const {fieldOptions, dataType} = this.props
    const defaultTimeField = getDefaultTimeField(dataType)
    const {sortedLabels, queryType} = this.getSortedLabelsAndQueryType()

    let graphFieldOptions = []
    if (
      dataType === DataType.influxQL &&
      queryType === InfluxQLQueryType.DataQuery
    ) {
      graphFieldOptions = [defaultTimeField]
    }

    sortedLabels.forEach(({label}) => {
      const field: FieldOption = {
        internalName: label,
        displayName: '',
        visible: true,
        direction: 'asc',
        tempVar: '',
      }
      graphFieldOptions = [...graphFieldOptions, field]
    })

    if (
      dataType === DataType.influxQL &&
      queryType === InfluxQLQueryType.MetaQuery
    ) {
      return graphFieldOptions
    }

    const intersection = fieldOptions.filter(f => {
      return graphFieldOptions.find(a => a.internalName === f.internalName)
    })

    const newFields = graphFieldOptions.filter(a => {
      return !fieldOptions.find(f => f.internalName === a.internalName)
    })

    return [...intersection, ...newFields]
  }

  // tableGaugeChartOptions 초기값 설정
  private makeTableGaugeChartOptions = (): TableGaugeChartOptionsInterface => {
    const {tableGaugeChartOptions, dataType, data} = this.props
    const {sortedLabels, queryType} = this.getSortedLabelsAndQueryType()

    const defaultTimeField = _.get(data, '0.response.results.0.series', '')
    const setName = Object.keys(defaultTimeField[0].tags)

    let tempOptions: ColumnSettingInterface[] = []

    sortedLabels.forEach(({label}) => {
      const option: ColumnSettingInterface = {
        ...DEFAULT_COLUMN_SETTING,
        internalName: label,
      }

      if (setName.includes(option.internalName) || option.internalName === '') {
        tempOptions = [...tempOptions]
      } else {
        tempOptions = [...tempOptions, option]
      }
    })

    if (
      dataType === DataType.influxQL &&
      queryType === InfluxQLQueryType.MetaQuery
    ) {
      return {
        ...tableGaugeChartOptions,
        columnSettings: tempOptions,
      }
    }

    const intersection = tableGaugeChartOptions.columnSettings.filter(f => {
      return tempOptions.find(a => a.internalName === f.internalName)
    })

    const newFields = tempOptions.filter(a => {
      return !tableGaugeChartOptions.columnSettings.find(
        f => f.internalName === a.internalName
      )
    })

    return {
      ...tableGaugeChartOptions,
      columnSettings: [...intersection, ...newFields],
    }
  }

  private getSortedLabelsAndQueryType = (): {
    sortedLabels: Label[]
    queryType: InfluxQLQueryType
  } => {
    const {data} = this.props

    const results = constructResults(data)
    const serieses = constructSerieses(results)
    const {sortedLabels, queryType} = constructCells(serieses)

    return {sortedLabels, queryType}
  }
}

export default StaticGraphFormat
