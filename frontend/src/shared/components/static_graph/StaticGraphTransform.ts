import _ from 'lodash'

import {fastMap, fastForEach, fastConcat, fastReduce} from 'src/utils/fast'
import {getDeep} from 'src/utils/wrappers'

import {
  TimeSeriesServerResponse,
  TimeSeriesResult,
  TimeSeriesSeries,
  TimeSeriesValue,
  TimeSeriesSuccessfulResult,
  InfluxQLQueryType,
} from 'src/types/series'

interface Result {
  series: TimeSeriesSeries[]
  responseIndex: number
  isGroupBy?: boolean
}

interface Series {
  name?: string
  columns: string[]
  values: TimeSeriesValue[][]
  responseIndex: number
  seriesIndex: number
  isGroupBy?: boolean
  tags?: {[x: string]: string}
  tagsKeys?: string[]
}

interface Cells {
  isGroupBy: boolean[]
  seriesIndex: number[]
  responseIndex: number[]
  label: string[]
  value: TimeSeriesValue[]
  time: TimeSeriesValue[]
}

interface Label {
  label: string
  seriesIndex: number
  responseIndex: number
}

const flattenGroupBySeries = (
  results: TimeSeriesSuccessfulResult[],
  responseIndex: number,
  tags: {[x: string]: string}
): Result[] => {
  if (_.isEmpty(results)) {
    return []
  }

  const tagsKeys = _.keys(tags)
  const seriesArray = getDeep<TimeSeriesSeries[]>(results, '[0].series', [])

  const accumulatedValues = fastReduce<TimeSeriesSeries, TimeSeriesValue[][]>(
    seriesArray,
    (acc, s) => {
      const tagsToAdd: string[] = tagsKeys.map(tk => s.tags[tk])
      const values = s.values
      const newValues = values.map(([first, ...rest]) => [
        first,
        ...tagsToAdd,
        ...rest,
      ])
      return [...acc, ...newValues]
    },
    []
  )
  const firstColumns = getDeep<string[]>(results, '[0].series[0]columns', [])

  const flattenedSeries: Result[] = [
    {
      series: [
        {
          columns: firstColumns,
          tags: _.get(results, [0, 'series', 0, 'tags'], {}),
          name: _.get(results, [0, 'series', 0, 'name'], ''),
          values: [...accumulatedValues],
        },
      ],
      responseIndex,
      isGroupBy: true,
    },
  ]

  return flattenedSeries
}

export const constructResults = (
  data: TimeSeriesServerResponse[]
): Result[] => {
  const MappedResponse = fastMap<TimeSeriesServerResponse, Result[]>(
    data,
    (response, index) => {
      const results = getDeep<TimeSeriesResult[]>(
        response,
        'response.results',
        []
      )

      const successfulResults = results.filter(
        r => 'series' in r && !('error' in r)
      ) as TimeSeriesSuccessfulResult[]

      const tagsFromResults: {[x: string]: string} = _.get(
        results,
        ['0', 'series', '0', 'tags'],
        {}
      )
      const hasGroupBy = !_.isEmpty(tagsFromResults)
      if (hasGroupBy) {
        const groupBySeries = flattenGroupBySeries(
          successfulResults,
          index,
          tagsFromResults
        )
        return groupBySeries
      }

      const noGroupBySeries = fastMap<TimeSeriesSuccessfulResult, Result>(
        successfulResults,
        r => ({
          ...r,
          responseIndex: index,
        })
      )
      return noGroupBySeries
    }
  )
  return _.flatten(MappedResponse)
}

export const constructSerieses = (results: Result[]): Series[] => {
  return _.flatten(
    fastMap<Result, Series[]>(results, ({series, responseIndex, isGroupBy}) =>
      fastMap<TimeSeriesSeries, Series>(series, (s, index) => ({
        ...s,
        responseIndex,
        isGroupBy,
        seriesIndex: index,
      }))
    )
  )
}

export const constructCells = (
  serieses: Series[]
): {
  cells: Cells
  sortedLabels: Label[]
  seriesLabels: Label[][]
  queryType: InfluxQLQueryType
  metaQuerySeries?: TimeSeriesValue[][]
} => {
  let cellIndex = 0
  let labels: Label[] = []
  let isMetaQuery = false
  let isDataQuery = false
  const seriesLabels: Label[][] = []
  const cells: Cells = {
    label: [],
    value: [],
    time: [],
    isGroupBy: [],
    seriesIndex: [],
    responseIndex: [],
  }
  let metaQuerySeries: TimeSeriesValue[][] = []

  fastForEach<Series>(
    serieses,
    (
      {
        name: measurement,
        columns,
        values = [],
        seriesIndex,
        responseIndex,
        isGroupBy,
        tags = {},
      },
      ind
    ) => {
      if (columns.find(c => c === 'time')) {
        let unsortedLabels: Label[]

        if (isGroupBy) {
          const labelsFromTags = fastMap<string, Label>(
            _.keys(tags),
            field => ({
              label: `${field}`,
              responseIndex,
              seriesIndex,
            })
          )
          const labelsFromColumns = fastMap<string, Label>(
            columns.slice(1),
            field => ({
              label: `${measurement}.${field}`,
              responseIndex,
              seriesIndex,
            })
          )

          unsortedLabels = fastConcat<Label>(labelsFromTags, labelsFromColumns)
          seriesLabels[ind] = unsortedLabels
          labels = _.concat(labels, unsortedLabels)
        } else {
          const tagSet = fastMap<string, string>(
            _.keys(tags),
            tag => `[${tag}=${tags[tag]}]`
          )
            .sort()
            .join('')

          unsortedLabels = fastMap<string, Label>(columns.slice(1), field => ({
            label: `${measurement}.${field}${tagSet}`,
            responseIndex,
            seriesIndex,
          }))
          seriesLabels[ind] = unsortedLabels
          labels = _.concat(labels, unsortedLabels)
          fastForEach(values, vals => {
            const [time, ...rowValues] = vals
            fastForEach(rowValues, (value, i) => {
              cells.label[cellIndex] = unsortedLabels[i].label
              cells.value[cellIndex] = value
              cells.time[cellIndex] = time
              isDataQuery = true
              cells.seriesIndex[cellIndex] = seriesIndex
              cells.responseIndex[cellIndex] = responseIndex
              cellIndex++ // eslint-disable-line no-plusplus
            })
          })
        }
      } else {
        isMetaQuery = true

        if (serieses.length === 1) {
          labels = columns.map(c => ({
            label: c,
            responseIndex,
            seriesIndex,
          }))

          metaQuerySeries = [columns, ...values]
        } else {
          labels = columns.map(c => ({
            label: c,
            responseIndex,
            seriesIndex,
          }))
          labels.unshift({
            label: 'measurement',
            responseIndex,
            seriesIndex,
          })

          const [, ...vals] = metaQuerySeries

          const allValuesForMeasurement = values.map(val => {
            return [measurement, ...val]
          })

          metaQuerySeries = [
            ['measurement', ...columns],
            ...vals,
            ...allValuesForMeasurement,
          ]
        }
      }
    }
  )

  let queryType: InfluxQLQueryType

  if (isMetaQuery && isDataQuery) {
    queryType = InfluxQLQueryType.ComboQuery
  } else if (isMetaQuery) {
    queryType = InfluxQLQueryType.MetaQuery
  } else {
    queryType = InfluxQLQueryType.DataQuery
  }

  const sortedLabels =
    queryType === InfluxQLQueryType.MetaQuery
      ? labels
      : _.sortBy(labels, 'label')

  return {cells, sortedLabels, seriesLabels, queryType, metaQuerySeries}
}
