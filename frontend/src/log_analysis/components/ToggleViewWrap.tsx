//Library
import React, {ChangeEvent, useCallback, useMemo, useState, useRef, useEffect} from 'react'
import {debounce} from 'lodash'

//Components
import WordCloud from 'src/dashboards/components/WordCloud'
import ToggleView from 'src/dashboards/components/ToggleView'
import {useResizeObserver} from 'src/dashboards/hooks/useResizeObserver'
import LogAnalysisTreeMap from 'src/log_analysis/components/LogAnalysisTreeMap'

//Types
import type {BaseElasticSearchData, FilteredLogsForLogAnalysis} from 'src/types'
import {TokenData} from 'src/dashboards/types'

//Apis
import {fetchMessageTokenData} from 'src/log_analysis/apis'

//Constants
import {LOG_ANALYSIS_LOCAL_STORAGE_KEY} from 'src/log_analysis/constants'

//Hooks
import {useLocalStorage} from 'src/log_analysis/hooks/useLocalStorage'

//Utils
import {buildCombinedFilters} from 'src/log_analysis/util'
import {CloudTimeRange} from 'src/clouds/types'

//Redux
import {useDispatch} from 'react-redux'

//Actions
import {addLogAnalysisMatchPhraseFilterClause} from 'src/log_analysis/actions'

//Interface
interface ViewProps {
  data: TokenData[]
  onRectClick: (token: string) => void
  onChangeTopN: (e: ChangeEvent<HTMLInputElement>) => void
  localTopN: number
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

  const [localTopN, setLocalTopN] = useState(topN)




  const fetchTokenData = useCallback(
    async (
      src: BaseElasticSearchData,
      size: number,
      cloudTimeRange?: CloudTimeRange,
      filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
    ) => {
      if ((!isNaN(size) && size) < data.length) return
      setLoading(true)
    
      try {
        const combinedFilters = buildCombinedFilters(
          filteredLogsForLogAnalysis,
          cloudTimeRange?.logAnalysis
        )
        const {data:newData} = await fetchMessageTokenData({
          esSource: src,
          filters: combinedFilters,
          size,
        })

        setData(newData)
      } finally {
        setLoading(false)
      }
    },
    [data]
  )



  const addMessageTokensFilter = (token): void => {
    dispatch(addLogAnalysisMatchPhraseFilterClause('message_tokens', token))
  }

  const handleRectClick = useCallback((token: string) => {
    addMessageTokensFilter(token)
  }, [])

  const debouncedSetTopN = useRef(
    debounce((value: number) => {
      setLocalTopN(value)
    }, 500)
  ).current

  const onChangeTopN = (number: number) => {
    setTopN(number)
    debouncedSetTopN(number)
  }

  useEffect(() => {
    return () => {
      debouncedSetTopN.cancel()
    }
  }, [debouncedSetTopN])

  const handleOnBlur = () => {  
    if (isNaN(topN)) {
      setTopN(DEFAULT_TOP_N)
      setLocalTopN(DEFAULT_TOP_N)
    }
  }

  const views = useMemo(
    () => [
      {
        key: 'tree-map',
        label: 'Tree Map',
        Component: TreeMapComponent,
        props: (d: TokenData[]) => ({
          data: d,
          onRectClick: handleRectClick,
          localTopN:localTopN,
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
          localTopN:localTopN,
        }),
        fetchData: fetchTokenData,
      },
    ],
    [fetchTokenData, localTopN, handleRectClick,data]
  )

  return (
    <>
      <ToggleView
        loading={loading}
        onChangeTopN={onChangeTopN}
        handleOnBlur={handleOnBlur}
        topN={topN}
        localTopN={localTopN}
        views={views.map(v => ({...v, props: v.props(data)}))}
      />
    </>
  )
}

function TreeMapComponent({data, onRectClick, localTopN}: ViewProps) {
  const [ref, {width, height}] = useResizeObserver<HTMLDivElement>()
  return (
    <div ref={ref} className="relative-full">
      {width > 0 && height > 0 && (
        <LogAnalysisTreeMap
          width={width}
          height={height}
          data={data}
          topN={localTopN}
          onRectClick={onRectClick}
        />
      )}
    </div>
  )
}

function TagCloudComponent({data, onRectClick, localTopN}: ViewProps) {
  const [containerRef, {width, height}] = useResizeObserver<HTMLDivElement>()
  return (
    <div ref={containerRef} className="relative-full">
      {width > 0 && height > 0 && (
        <WordCloud
          data={data}
          width={width}
          height={height}
          onSelect={onRectClick}
          topN={localTopN}
        />
      )}
    </div>
  )
}
