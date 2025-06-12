// WordCloudDemo.tsx – complete version with English comments

import React, {useCallback, useMemo, useRef, useState} from 'react'
import WordCloud from '../../dashboards/components/WordCloud'
import ToggleView from '../../dashboards/components/ToggleView'
import {useResizeObserver} from '../../dashboards/hooks/useResizeObserver'
import LogAnalysisTreeMap from 'src/log_analysis/components/LogAnalysisTreeMap'

import type {BaseElasticSearchData} from 'src/types'
import {TokenData} from 'src/dashboards/types'
import {fetchMessageTokenData} from '../apis'

interface ViewProps {
  data: TokenData[]
  onRectClick: (token: string, raw: number, pct: number) => void
}

export default function ToggleViewWrap() {
  const [data, setData] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(false)

  const handleRectClick = (token: string, raw: number, pct: number) => {
    console.log(`Clicked → ${token} | ${raw} (${pct.toFixed(2)}%)`)
  }

  const fetchTokenData = useCallback(async (src: BaseElasticSearchData) => {
    setLoading(true)

    try {
      const {data} = await fetchMessageTokenData(
        src,
        '2025-05-26T08:16:03.312Z',
        new Date().toISOString(),
        300
      )
      setData(data)
    } finally {
      setLoading(false)
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
          topN={300}
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
