// pages/WordCloudDemo.tsx
import React, {useMemo, useState, useEffect} from 'react'
import WordCloud from '../../dashboards/components/WordCloud'
import {smallSample} from '../../dashboards/mocks/mock'
import {WordDatum} from '../../dashboards/types'
import ToggleView from '../../dashboards/components/ToggleView'

import {useResizeObserver} from '../../dashboards/hooks/useResizeObserver'

import LogAnalysisTreeMap from 'src/log_analysis/components/LogAnalysisTreeMap'

interface Props {
  data: string
}

export default function ToggleViewWrap() {
  const [data, setData] = useState<string>('')

  const views = [
    {
      key: 'word-cloud',
      label: 'Tag Cloud',
      Component: WordCloud_1,
      props: {data},
      fetchData: async () => {
        setData('3')
        console.log('3')
      },
    },
    {
      key: 'tree-map',
      label: 'Tree Map',
      Component: WordCloud_2,
      props: {data},
      fetchData: async () => {
        setData('2')
        console.log('2')
      },
    },
  ]

  return (
    <>
      <ToggleView loading={false} views={views} source={undefined} />
    </>
  )
}

export function WordCloud_1({data}: Props) {
  const [filterText, setFilterText] = useState<string | null>(null)
  const filteredData: WordDatum[] = useMemo(
    () =>
      filterText ? smallSample.filter(w => w.text !== filterText) : smallSample,
    [filterText]
  )

  const [containerRef] = useResizeObserver<HTMLDivElement>()

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: 'white',
        margin: 10,
      }}
    >
      <LogAnalysisTreeMap
        data={[
          {token: 'error', count: 120},
          {token: 'login', count: 80},
          {token: 'timeout', count: 30},
        ]}
      />
    </div>
  )
}

export function WordCloud_2({data}: Props) {
  const [filterText, setFilterText] = useState<string | null>(null)
  const filteredData: WordDatum[] = useMemo(
    () =>
      filterText ? smallSample.filter(w => w.text !== filterText) : smallSample,
    [filterText]
  )

  const [containerRef, {width, height}] = useResizeObserver<HTMLDivElement>()

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
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
