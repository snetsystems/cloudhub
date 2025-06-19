import {TokenData, LogCountData} from 'src/dashboards/types'
import {
  BaseElasticSearchData,
  FilteredLogsForLogAnalysis,
  SyslogTableRows,
} from 'src/types'
import {asyncSearch} from '../util/ensureAsyncSearch'

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

export async function fetchSyslogTableData(
  esSource: BaseElasticSearchData,
  filters: FilteredLogsForLogAnalysis,
  pageIndex: number,
  pageSize: number,
  sortColumns: {id: string; direction: 'asc' | 'desc'}[]
): Promise<{data: SyslogTableRows[]; total: number}> {
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

  const body = {
    track_total_hits: true,
    from: pageIndex * pageSize,
    size: pageSize,
    sort,
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
    path: '/syslog-*/_async_search',
    method: 'POST',
    body,
  })

  const hitsArray = res?.rawResponse?.hits?.hits
  const total =
    typeof res.rawResponse.hits.total === 'object'
      ? res.rawResponse.hits.total.value
      : res.rawResponse.hits.total
  const data = Array.isArray(hitsArray)
    ? hitsArray.map(hit => ({
        id: hit._id,
        ...hit.fields,
        _highlight: hit.highlight,
      }))
    : []

  return {data, total}
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
