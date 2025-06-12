// WordCloudDemo.tsx – complete version with English comments

import React, {ChangeEvent, useCallback, useMemo, useRef, useState} from 'react'
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
  onChangeTopN
  topN: string
}
const MAX_TOP_N = 1000
const DEFAULT_TOP_N = 100
export default function ToggleViewWrap() {
  const [data, setData] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(false)
  const [topN, setTopN] = useState(DEFAULT_TOP_N)
  const [isMoreFetch, setIsMoreFetch] = useState(false)
  const handleRectClick = (token: string, raw: number, pct: number) => {
    console.log(`Clicked → ${token} | ${raw} (${pct.toFixed(2)}%)`)
  }

  const ohChangeTopN = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)

    if (!isNaN(value) && value > MAX_TOP_N) return
    setTopN(value)
    if (!isNaN(value) && value > data.length) setIsMoreFetch(true)
  }

  const handleOnBlur = () => {
    if (isNaN(topN)) setTopN(DEFAULT_TOP_N)
  }

  const fetchTokenData = useCallback(
    async (src: BaseElasticSearchData, size: number) => {
      setLoading(true)
      try {
        const {data} = await fetchMessageTokenData({
          esSource: src,
          gteISO: '2025-05-26T08:16:03.312Z',
          lteISO: new Date().toISOString(),
          size,
        })
        setData(data)
        setIsMoreFetch(false)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const views = useMemo(
    () => [
      {
        key: 'tree-map',
        label: 'Tree Map',
        Component: TreeMapComponent,
        props: (d: TokenData[]) => ({
          data: d,
          onRectClick: handleRectClick,
          topN,
        }),
        fetchData: fetchTokenData,
      },
      {
        key: 'word-cloud',
        label: 'Tag Cloud',
        Component: TagCloudComponent,
        props: (d: TokenData[]) => ({
          data: d,
          onRectClick: handleRectClick,
          topN,
        }),
        fetchData: fetchTokenData,
      },
    ],
    [fetchTokenData, topN]
  )

  return (
    <ToggleView
      loading={loading}
      onChangeTopN={ohChangeTopN}
      handleOnBlur={handleOnBlur}
      topN={topN}
      isMoreFetch={isMoreFetch}
      views={views.map(v => ({...v, props: v.props(data)}))}
    />
  )
}

function TreeMapComponent({data, onRectClick, topN}: ViewProps) {
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
          topN={parseInt(topN, 10)}
          onRectClick={onRectClick}
        />
      )}
    </div>
  )
}

function TagCloudComponent({data, topN}: ViewProps) {
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
          topN={parseInt(topN, 10)}
        />
      )}
    </div>
  )
}
