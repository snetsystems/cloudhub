// WordCloudDemo.tsx – complete version with English comments

import React, {useCallback, useMemo, useRef, useState} from 'react'
import WordCloud from '../../dashboards/components/WordCloud'
import ToggleView from '../../dashboards/components/ToggleView'
import {useResizeObserver} from '../../dashboards/hooks/useResizeObserver'
import LogAnalysisTreeMap from 'src/log_analysis/components/LogAnalysisTreeMap'

import type {BaseElasticSearchData} from 'src/types'
import {TokenData} from 'src/dashboards/types'
import {ensureAsyncSearch} from '../util/ensureAsyncSearch'

export async function fetchMessageTokenDatas(
  esSource: BaseElasticSearchData,
  gteISO: string,
  lteISO: string,
  prevId?: string,
  size = 100
): Promise<{stats: TokenData[]; id: string}> {
  const params = {
    batched_reduce_size: 64,
    ccs_minimize_roundtrips: true,
    wait_for_completion_timeout: '5s',
    keep_on_completion: true,
    keep_alive: '60000ms',
    ignore_unavailable: true,
    preference: Date.now(),
  } as const

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

  const res = await ensureAsyncSearch(esSource.links.proxy, {
    path: '/syslog-*/_async_search',
    method: 'POST',
    params,
    body,
    searchId: prevId,
  })

  const stats: TokenData[] = res.rawResponse.aggregations[
    'token_stat'
  ].buckets.map((b: {key: string; doc_count: number}) => ({
    text: b.key,
    value: b.doc_count,
  }))

  return {stats, id: res.id}
}

interface ViewProps {
  data: TokenData[]
  onRectClick: (token: string, raw: number, pct: number) => void
}

export default function ToggleViewWrap() {
  const [data, setData] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)
  const lastSearchId = useRef<string>()

  const handleRectClick = (token: string, raw: number, pct: number) => {
    console.log(`Clicked → ${token} | ${raw} (${pct.toFixed(2)}%)`)
  }

  const fetchTokenData = useCallback(async (src: BaseElasticSearchData) => {
    setLoading(true)
    if (inFlight.current) return
    inFlight.current = true

    try {
      const {stats, id} = await fetchMessageTokenDatas(
        src,
        new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        new Date().toISOString(),
        lastSearchId.current
      )
      lastSearchId.current = id
      setData(stats)
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }, [])

  const views = useMemo(
    () => [
      {
        key: 'tree-map',
        label: 'Tree Map',
        Component: TreeMapComponent,
        props: (d: TokenData[]) => ({data: d, onRectClick: handleRectClick}),
        fetchData: fetchTokenData,
      },
      {
        key: 'word-cloud',
        label: 'Tag Cloud',
        Component: TagCloudComponent,
        props: (d: TokenData[]) => ({data: d, onRectClick: handleRectClick}),
        fetchData: fetchTokenData,
      },
    ],
    [fetchTokenData]
  )

  return (
    <ToggleView
      loading={loading}
      views={views.map(v => ({...v, props: v.props(data)}))}
    />
  )
}

function TreeMapComponent({data, onRectClick}: ViewProps) {
  const [filterText, setFilterText] = useState<string | null>(null)
  const filtered = useMemo(
    () => (filterText ? data.filter(d => d.text !== filterText) : data),
    [data, filterText]
  )

  const [ref, {width, height}] = useResizeObserver<HTMLDivElement>()
  return (
    <div
      ref={ref}
      style={{width: '100%', height: '100%', position: 'relative'}}
    >
      {width > 0 && height > 0 && (
        <LogAnalysisTreeMap
          width={width}
          height={height}
          data={filtered}
          minTileWidth={5}
          minTileHeight={5}
          topN={100}
          onRectClick={onRectClick}
        />
      )}
    </div>
  )
}

function TagCloudComponent({data}: ViewProps) {
  const [filterText, setFilterText] = useState<string | null>(null)
  const filteredData: TokenData[] = useMemo(
    () => (filterText ? data.filter(w => w.text !== filterText) : data),
    [filterText, data]
  )

  const [containerRef, {width, height}] = useResizeObserver<HTMLDivElement>()

  return (
    <div
      ref={containerRef}
      style={{width: '100%', height: '100%', position: 'relative'}}
    >
      {width > 0 && height > 0 && (
        <WordCloud
          data={filteredData}
          width={width}
          height={height}
          onSelect={d => setFilterText(d.text)}
        />
      )}
    </div>
  )
}
