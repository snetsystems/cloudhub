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
import {DataType} from 'src/shared/constants'

// Types
import {
  TimeSeriesServerResponse,
  Label,
  InfluxQLQueryType,
} from 'src/types/series'
import {FieldOption} from 'src/types/dashboards'

interface Props {
  data: TimeSeriesServerResponse[]
  dataType: DataType
  fieldOptions: FieldOption[]
  uuid: string
  children: (computedFieldOptions: FieldOption[]) => JSX.Element
}

interface State {
  computedFieldOptions: FieldOption[]
  invalidDataError: ErrorTypes
}

class StaticGraphFormat extends PureComponent<Props, State> {
  private isComponentMounted: boolean

  constructor(props: Props) {
    super(props)

    this.state = {
      computedFieldOptions: props.fieldOptions,
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

    return this.props.children(this.state.computedFieldOptions)
  }

  public componentDidMount() {
    this.isComponentMounted = true

    this.formatStaticGraphData()
  }

  public componentWillUnmount() {
    this.isComponentMounted = false
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.uuid !== this.props.uuid) {
      this.formatStaticGraphData()
    }
  }

  private formatStaticGraphData = async () => {
    const computedFieldOptions = this.makeStaticGraphFieldOptions()

    try {
      if (!this.isComponentMounted) {
        return
      }

      this.setState({
        computedFieldOptions,
        invalidDataError: null,
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
