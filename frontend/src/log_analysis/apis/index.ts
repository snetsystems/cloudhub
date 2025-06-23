import {TokenData, LogCountData} from 'src/dashboards/types'
import {
  BaseElasticSearchData,
  FilteredLogsForLogAnalysis,
  SyslogTableRows,
} from 'src/types'
import {asyncSearch, DEFAULT_OPTS} from '../util/ensureAsyncSearch'
import {esProxy} from 'src/utils/esQueryUrlGenerator'
import {
  AutoCompleteResult,
  FieldInfo,
  FieldListResponse,
} from 'src/types/elasticSearch'
import {
  ALWAYS_TOP_FIELDS,
  KNOWN_ES_FIELD_TYPES,
  LOGICAL_OPERATORS,
  OperatorMeta,
} from 'src/log_analysis/constants/search-filter'
import {
  ESRange,
  buildTimeRangeFilter,
  getFieldOperatorsWithLogical,
} from 'src/log_analysis/util'

export async function fetchMessageTokenData({
  esSource,
  filters,
  size = 100,
}: {
  esSource: BaseElasticSearchData
  filters: FilteredLogsForLogAnalysis
  size: number
}): Promise<{data: TokenData[]}> {
  const body = {
    aggs: {
      token_stat: {
        terms: {
          field: 'message_tokens',
          order: {_count: 'desc'},
          size: size,
        },
      },
    },
    size: 0,
    _source: {excludes: []},
    query: {
      bool: {
        must: [],
        filter: filters,
        should: [],
        must_not: [],
      },
    },
    stored_fields: ['*'],
    runtime_mappings: {},
    script_fields: {},
    fields: [{field: '@timestamp', format: 'date_time'}],
  }
  const res = await asyncSearch(esSource.links.proxy, {
    path: '/syslog-*/_async_search',
    method: 'POST',
    body,
  })

  const data: TokenData[] = res.rawResponse.aggregations[
    'token_stat'
  ].buckets.map((b: {key: string; doc_count: number}) => ({
    text: b.key,
    value: b.doc_count,
  }))

  return {data}
}

export async function openPit(
  esSource: BaseElasticSearchData,
  keepAlive: string = DEFAULT_OPTS.keepAlive
): Promise<string> {
  const {data} = await esProxy(esSource.links.proxy, {
    path: `/syslog-*/_pit?keep_alive=${keepAlive}`,
    method: 'POST',
  })

  return data.id
}

export async function closePit(
  esSource: BaseElasticSearchData,
  pitId: string
): Promise<void> {
  await esProxy(esSource.links.proxy, {
    path: '/_pit',
    method: 'DELETE',
    body: {pit_id: pitId},
  })
}

export async function fetchSyslogTableData(
  esSource: BaseElasticSearchData,
  filters: FilteredLogsForLogAnalysis,
  pageSize: number,
  sortColumns: {id: string; direction: 'asc' | 'desc'}[],
  searchAfter?: any
): Promise<{data: SyslogTableRows[]; total: number; lastSortValues: any}> {
  const sort = sortColumns.length
    ? sortColumns.map(({id, direction}) => ({
        [id]: {
          order: direction,
          format: id === '@timestamp' ? 'strict_date_optional_time' : undefined,
          unmapped_type: 'boolean',
        },
      }))
    : [
        {
          '@timestamp': {
            order: 'desc',
            format: 'strict_date_optional_time',
            unmapped_type: 'boolean',
          },
        },
        {_doc: {order: 'desc', unmapped_type: 'boolean'}},
      ]

  const body: Record<string, any> = {
    track_total_hits: true,
    size: pageSize,
    sort,
    ...(searchAfter != null ? {search_after: searchAfter} : {}),
    fields: [
      {field: '*', include_unmapped: true},
      {field: '@timestamp', format: 'strict_date_optional_time'},
    ],
    _source: false,
    query: {
      bool: {
        must: [],
        filter: filters,
        should: [],
        must_not: [],
      },
    },
    highlight: {
      pre_tags: ["<span class='logs-analysis-highlight--match'>"],
      post_tags: ['</span>'],
      fields: {
        'host.hostname': {},
        message: {},
        message_tokens: {},
        'event.original': {},
        'service.type': {},
        'process.name': {},
      },
      fragment_size: 2147483647,
    },
    stored_fields: ['*'],
    runtime_mappings: {},
    script_fields: {},
  }

  const res = await asyncSearch(esSource.links.proxy, {
    path: '/_async_search',
    method: 'POST',
    body,
  })

  const hitsArray = res?.rawResponse?.hits?.hits || []
  const total =
    typeof res.rawResponse.hits.total === 'object'
      ? res.rawResponse.hits.total.value
      : res.rawResponse.hits.total

  const data = hitsArray.map(hit => ({
    id: hit._id,
    ...hit.fields,
    _highlight: hit.highlight,
  }))

  const lastSortValues = hitsArray.length
    ? hitsArray[hitsArray.length - 1].sort
    : undefined

  return {data, total, lastSortValues}
}

export async function fetchSyslogTableDataWithPit(
  esSource: BaseElasticSearchData,
  filters: FilteredLogsForLogAnalysis,
  pageSize: number,
  sortColumns: {id: string; direction: 'asc' | 'desc'}[],
  pitId: string,
  searchAfter?: any
): Promise<{data: SyslogTableRows[]; total: number; lastSortValues: any}> {
  if (pitId === null) {
    return {data: [], total: 0, lastSortValues: undefined}
  }

  const sort = sortColumns.length
    ? sortColumns.map(({id, direction}) => ({
        [id]: {
          order: direction,
          format: id === '@timestamp' ? 'strict_date_optional_time' : undefined,
          unmapped_type: 'boolean',
        },
      }))
    : [
        {
          '@timestamp': {
            order: 'desc',
            format: 'strict_date_optional_time',
            unmapped_type: 'boolean',
          },
        },
        {_doc: {order: 'desc', unmapped_type: 'boolean'}},
      ]

  const body: Record<string, any> = {
    pit: {id: pitId, keep_alive: '1m'},
    track_total_hits: true,
    size: pageSize,
    sort,
    ...(searchAfter != null ? {search_after: searchAfter} : {}),
    fields: [
      {field: '*', include_unmapped: true},
      {field: '@timestamp', format: 'strict_date_optional_time'},
    ],
    _source: false,
    query: {
      bool: {
        must: [],
        filter: filters,
        should: [],
        must_not: [],
      },
    },
    highlight: {
      pre_tags: ["<span class='logs-analysis-highlight--match'>"],
      post_tags: ['</span>'],
      fields: {
        'host.hostname': {},
        message: {},
        message_tokens: {},
        'event.original': {},
        'service.type': {},
        'process.name': {},
      },
      fragment_size: 2147483647,
    },
    stored_fields: ['*'],
    runtime_mappings: {},
    script_fields: {},
  }

  const res = await asyncSearch(esSource.links.proxy, {
    path: '/_async_search',
    method: 'POST',
    body,
  })

  const hitsArray = res?.rawResponse?.hits?.hits || []
  const total =
    typeof res.rawResponse.hits.total === 'object'
      ? res.rawResponse.hits.total.value
      : res.rawResponse.hits.total

  const data = hitsArray.map(hit => ({
    id: hit._id,
    ...hit.fields,
    _highlight: hit.highlight,
  }))

  const lastSortValues = hitsArray.length
    ? hitsArray[hitsArray.length - 1].sort
    : undefined

  return {data, total, lastSortValues}
}

export async function fetchLogsCount({
  esSource,
  gteISO,
  lteISO,
}: {
  esSource: BaseElasticSearchData
  gteISO: string
  lteISO: string
}): Promise<{data: LogCountData[]}> {
  const body = {
    aggs: {
      '0': {
        date_histogram: {
          field: '@timestamp',
          calendar_interval: '1d',
          time_zone: 'UTC',
          extended_bounds: {
            min: gteISO,
            max: lteISO,
          },
        },
      },
    },
    size: 0,
    _source: {excludes: []},
    query: {
      bool: {
        must: [],
        should: [],
        must_not: [],
        filter: [
          {
            range: {
              '@timestamp': {
                format: 'strict_date_optional_time',
                gte: gteISO,
                lte: lteISO,
              },
            },
          },
        ],
      },
    },
    stored_fields: ['*'],
    runtime_mappings: {},
    script_fields: {},
    fields: [{field: '@timestamp', format: 'date_time'}],
  }

  const res = await asyncSearch(esSource.links.proxy, {
    path: '/syslog-*/_async_search',
    method: 'POST',
    body,
  })

  const data: LogCountData[] = res.rawResponse.aggregations['0'].buckets.map(
    (b: {key: string; doc_count: number}) => ({
      time: b.key,
      value: b.doc_count,
    })
  )

  return {data}
}

export async function fetchKibanaFieldList({
  esSource,
  indexPattern = 'syslog-*',
}: {
  esSource: BaseElasticSearchData
  indexPattern?: string
}): Promise<FieldListResponse> {
  try {
    const {data} = await esProxy(esSource.links.proxy, {
      path: `/${indexPattern}/_field_caps?fields=*`,
      method: 'POST',
    })

    const fieldTypeMap: Record<string, string> = {}
    Object.entries(data?.fields ?? {}).forEach(([field, typeObj]) => {
      const types = Object.keys(typeObj)

      if (types.length === 1) {
        fieldTypeMap[field] = types[0]
      } else {
        fieldTypeMap[field] =
          types.find(t => KNOWN_ES_FIELD_TYPES.includes(t)) || types[0]
      }
    })

    const usableFields = [
      ...new Set([
        ...Object.entries(data?.fields ?? {})
          .filter(([_, typeObj]) => {
            const typeNames = Object.keys(typeObj)
            if (typeNames.length === 1 && typeNames[0] === 'object')
              return false
            return Object.values(typeObj).some(
              (info: any) =>
                (info.searchable || info.aggregatable) && !info.metadata_field
            )
          })
          .map(([field]) => field),
        ...ALWAYS_TOP_FIELDS,
      ]),
    ]

    const topFields = ALWAYS_TOP_FIELDS.filter(f => usableFields.includes(f))
    const restFields = usableFields
      .filter(f => !ALWAYS_TOP_FIELDS.includes(f))
      .sort()

    const fields: FieldInfo[] = [...topFields, ...restFields].map(field => ({
      field,
      type: fieldTypeMap[field] || field,
    }))
    return {fields, total: fields.length}
  } catch (err) {
    return {fields: [], total: 0}
  }
}

export async function getAutoCompleteResult({
  input,
  allFields,
  esSource,
  timeRange,
  indexPattern = 'syslog-*',
}: {
  input: string
  allFields: FieldInfo[]
  esSource: BaseElasticSearchData
  timeRange: ESRange
  indexPattern?: string
}): Promise<AutoCompleteResult> {
  const logicalSplit = input.split(/\b(?:and|or)\b\s*/i)
  const current = logicalSplit[logicalSplit.length - 1] //
  const trimmed = current.trim()
  const endsWithSpace = current.endsWith(' ')
  let fields: FieldInfo[] = []
  let operators: OperatorMeta[] = []
  let values: string[] = []

  const match = trimmed.match(/^([\w\.\-]+)\s*[:!<>=]+\s*(.*)$/)
  if (match) {
    const field = match[1]
    const valueInput = match[2] || ''

    if (
      (valueInput && current.endsWith(' ')) ||
      /^".+"$/.test(valueInput.trim()) ||
      /^'.+'$/.test(valueInput.trim())
    ) {
      return {fields: [], operators: LOGICAL_OPERATORS, values: []}
    }

    try {
      const {data} = await esProxy(esSource.links.proxy, {
        path: `/${indexPattern}/_terms_enum`,
        method: 'POST',
        body: {
          field,
          string: valueInput,
          size: 10,
          ...buildTimeRangeFilter(timeRange),
        },
      })
      values = data.terms || []
    } catch {
      values = []
    }
    return {fields: [], operators: [], values}
  }

  const lower = trimmed.toLowerCase()
  const startsWithFields = allFields.filter(f =>
    f.field.toLowerCase().startsWith(lower)
  )
  const includesFields = allFields.filter(
    f =>
      !f.field.toLowerCase().startsWith(lower) &&
      f.field.toLowerCase().includes(lower)
  )
  fields = [...startsWithFields, ...includesFields]

  if (fields.length === 1) {
    if (!endsWithSpace) {
      operators = getFieldOperatorsWithLogical(fields[0].field, fields[0].type)
    } else {
      operators = [
        ...getFieldOperatorsWithLogical(fields[0].field, fields[0].type),
        ...LOGICAL_OPERATORS,
      ]
    }
  } else {
    operators = [
      {op: ':', label: 'equals', description: 'equals some value'},
      {op: ':*', label: 'exists', description: 'exists in any form'},
      ...(endsWithSpace ? LOGICAL_OPERATORS : []),
    ]
  }

  return {fields, operators}
}
