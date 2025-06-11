import {TokenData} from 'src/dashboards/types'
import {BaseElasticSearchData} from 'src/types'
import {asyncSearch} from '../util/ensureAsyncSearch'

export async function fetchMessageTokenData(
  esSource: BaseElasticSearchData,
  gteISO: string,
  lteISO: string,
  size = 100
): Promise<{data: TokenData[]}> {
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

  const data: TokenData[] = res.rawResponse.aggregations[
    'token_stat'
  ].buckets.map((b: {key: string; doc_count: number}) => ({
    text: b.key,
    value: b.doc_count,
  }))

  return {data}
}
