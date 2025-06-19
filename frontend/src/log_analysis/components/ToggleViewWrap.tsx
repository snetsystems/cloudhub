import React, {ChangeEvent, useCallback, useMemo, useState} from 'react'
import WordCloud from '../../dashboards/components/WordCloud'
import ToggleView from '../../dashboards/components/ToggleView'
import {useResizeObserver} from '../../dashboards/hooks/useResizeObserver'
import LogAnalysisTreeMap from 'src/log_analysis/components/LogAnalysisTreeMap'

import type {BaseElasticSearchData, FilteredLogsForLogAnalysis} from 'src/types'
import {TokenData} from 'src/dashboards/types'
import {fetchMessageTokenData} from '../apis'
import {LOG_ANALYSIS_LOCAL_STORAGE_KEY} from '../constants'
import {useLocalStorage} from '../hooks/useLocalStorage'
import {buildCombinedFilters} from 'src/log_analysis/util'
import {CloudTimeRange} from 'src/clouds/types'
import {useDispatch} from 'react-redux'
import {addLogAnalysisMatchPhraseFilterClause} from '../actions'
interface ViewProps {
  data: TokenData[]
  onRectClick: (token: string) => void
  onChangeTopN
  topN: string
}

const DEFAULT_TOP_N = 100
export default function ToggleViewWrap() {
  const dispatch = useDispatch()

  const [data, setData] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(false)
  const [storageObj, setStorageObj] = useLocalStorage<{
    filteredCount: number
  }>(LOG_ANALYSIS_LOCAL_STORAGE_KEY, {
    filteredCount: DEFAULT_TOP_N,
  })
  const topN = storageObj.filteredCount
  const setTopN = (value: number) =>
    setStorageObj(prev => ({...prev, filteredCount: value}))

  const [isMoreFetch, setIsMoreFetch] = useState(false)
  const addMessageTokensFilter = (token): void => {
    dispatch(addLogAnalysisMatchPhraseFilterClause('message_tokens', token))
  }
  const handleRectClick = useCallback((token: string) => {
    addMessageTokensFilter(token)
  }, [])
  const ohChangeTopN = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setTopN(value)
    if (!isNaN(value) && value > data.length) setIsMoreFetch(true)
  }

  const handleOnBlur = () => {
    if (isNaN(topN)) setTopN(DEFAULT_TOP_N)
  }

  const fetchTokenData = useCallback(
    async (
      src: BaseElasticSearchData,
      size: number,
      cloudTimeRange?: CloudTimeRange,
      filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
    ) => {
      setLoading(true)
      try {
        const combinedFilters = buildCombinedFilters(
          filteredLogsForLogAnalysis,
          cloudTimeRange?.logAnalysis
        )
        const {data} = await fetchMessageTokenData({
          esSource: src,
          filters: combinedFilters,
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
    [fetchTokenData, topN, handleRectClick]
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
  const [ref, {width, height}] = useResizeObserver<HTMLDivElement>()
  return (
    <div ref={ref} className="relative-full">
      {width > 0 && height > 0 && (
        <LogAnalysisTreeMap
          width={width}
          height={height}
          data={data}
          topN={parseInt(topN, 10)}
          onRectClick={onRectClick}
        />
      )}
    </div>
  )
}

function TagCloudComponent({data, onRectClick, topN}: ViewProps) {
  const [containerRef, {width, height}] = useResizeObserver<HTMLDivElement>()

  return (
    <div ref={containerRef} className="relative-full">
      {width > 0 && height > 0 && (
        <WordCloud
          data={data}
          width={width}
          height={height}
          onSelect={onRectClick}
          topN={parseInt(topN, 10)}
        />
      )}
    </div>
  )
}
