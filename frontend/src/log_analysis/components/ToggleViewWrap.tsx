import React, {ChangeEvent, useCallback, useMemo, useRef, useState} from 'react'
import WordCloud from '../../dashboards/components/WordCloud'
import ToggleView from '../../dashboards/components/ToggleView'
import {useResizeObserver} from '../../dashboards/hooks/useResizeObserver'
import LogAnalysisTreeMap from 'src/log_analysis/components/LogAnalysisTreeMap'

import type {BaseElasticSearchData, FilteredLogsForLogAnalysis} from 'src/types'
import {TokenData} from 'src/dashboards/types'
import {
  fetchKibanaFieldList,
  fetchMessageTokenData,
  getAutoCompleteResult,
} from '../apis'
import {LOG_ANALYSIS_LOCAL_STORAGE_KEY} from '../constants'
import {useLocalStorage} from '../hooks/useLocalStorage'
import {
  buildCombinedFilters,
  getFieldOperatorsWithLogical,
} from 'src/log_analysis/util'
import {CloudTimeRange} from 'src/clouds/types'
import {useDispatch} from 'react-redux'
import {addLogAnalysisMatchPhraseFilterClause} from '../actions'
import {AutoCompleteResult, FieldInfo} from 'src/types/elasticSearch'
import {LOGICAL_OPERATORS, OperatorMeta} from '../constants/search-filter'
import {Input, InputType} from 'src/reusable_ui'
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

  const [fields, setFields] = useState<FieldInfo[]>([])
  const [inputValue, setInputValue] = useState('')
  const [autocomplete, setAutocomplete] = useState<AutoCompleteResult>({
    fields: [],
    operators: [],
    values: [],
  })
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [dropdownItems, setDropdownItems] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const items: any[] = [
      ...autocomplete.fields.map(f => ({type: 'field', data: f})),
      ...autocomplete.operators.map(op => ({type: 'operator', data: op})),
      ...(autocomplete.values
        ? autocomplete.values.map(v => ({type: 'value', data: v}))
        : []),
    ]
    setDropdownItems(items)
    setActiveIndex(items.length > 0 ? 0 : -1)
  }, [autocomplete])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (dropdownItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(idx => (idx + 1 < dropdownItems.length ? idx + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(idx => (idx - 1 >= 0 ? idx - 1 : dropdownItems.length - 1))
    } else if (e.key === 'Enter' && activeIndex !== -1) {
      e.preventDefault()
      const item = dropdownItems[activeIndex]
      if (item.type === 'field') handleFieldSelect(item.data)
      if (item.type === 'operator') handleOperatorSelect(item.data)
      if (item.type === 'value') handleValueSelect(item.data)
    }
  }

  function getItemProps(index: number) {
    return {
      style: {
        background: index === activeIndex ? '#eaf6ff' : undefined,
        fontWeight: index === activeIndex ? 600 : undefined,
        cursor: 'pointer',
        padding: '6px 14px',
        borderBottom: '1px solid #eee',
      },
      onMouseEnter: () => setActiveIndex(index),
      onClick: () => {
        const item = dropdownItems[index]
        if (item.type === 'field') handleFieldSelect(item.data)
        if (item.type === 'operator') handleOperatorSelect(item.data)
        if (item.type === 'value') handleValueSelect(item.data)
      },
    }
  }

  const mockSource: BaseElasticSearchData = {
    id: '1082106298267889664',
    name: 'Defaultzzzzzzz',
    default: false,
    version: '8.17.3',
    url: 'https://10.20.2.216:9200',
    insecureSkipVerify: true,
    basicAuth: {
      username: 'jinhyeong.kim',
      password: '',
    },
    organization: 'default',
    authentication: 'basic',
    links: {
      self: '/cloudhub/v1/es/1082106298267889664',
      search: '',
      indices: '',
      bulk: '',
      permissions: '',
      users: '',
      roles: '',
      health: '/cloudhub/v1/es/1082106298267889664/health',
      proxy: '/cloudhub/v1/es/1082106298267889664/proxy',
    },
    defaultIndex: '',
    indexPatterns: [],
    apiKeyAuth: null,
  }
  async function handleFocus() {
    console.log(fields.length)
    if (fields.length === 0) {
      const {fields: f} = await fetchKibanaFieldList({
        esSource: mockSource,
      })

      setFields(f)
      const ac = await getAutoCompleteResult({
        input: inputValue,
        allFields: f,
        esSource: mockSource,
      })
      setAutocomplete(ac)
    } else {
      const ac = await getAutoCompleteResult({
        input: inputValue,
        allFields: fields,
        esSource: mockSource,
      })
      setAutocomplete(ac)
    }
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setInputValue(value)
    const ac = await getAutoCompleteResult({
      input: value,
      allFields: fields,
      esSource: mockSource,
    })
    setAutocomplete(ac)
  }

  async function handleFieldSelect(f: FieldInfo) {
    setInputValue(prev => {
      const match = prev.match(/^(.*?\b(?:and|or)\b\s*)$/i)
      if (match) {
        return match[1] + f.field + ' '
      }
      return f.field + ' '
    })
    console.log(`${inputValue} ${f.field}`)
    const ac = await getAutoCompleteResult({
      input: `${f.field} `,
      allFields: fields,
      esSource: mockSource,
    })
    setAutocomplete(ac)
  }

  async function handleOperatorSelect(op: OperatorMeta) {
    const newValue = `${inputValue.trim()} ${op.op} `
    setInputValue(newValue)
    const ac = await getAutoCompleteResult({
      input: newValue,
      allFields: fields,
      esSource: mockSource,
    })
    setAutocomplete(ac)
  }

  function handleValueSelect(value: string) {
    const needsQuotes = /[\s,:"]/g.test(value)
    const quoted = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value
    setInputValue(prev => prev.replace(/\s*$/, '') + ' ' + quoted + ' ')
    setAutocomplete({
      fields: [],
      operators: LOGICAL_OPERATORS,
      values: [],
    })
  }

  async function handleLogicalOperatorSelect(op: OperatorMeta) {
    const newValue = `${inputValue.trim()} ${op.op} `
    setInputValue(newValue)

    const ac = await getAutoCompleteResult({
      input: '',
      allFields: fields,
      esSource: mockSource,
    })
    setAutocomplete(ac)
  }
  return (
    <>
      <div style={{position: 'relative', width: 400}}>
        <Input
          type={InputType.Text}
          value={inputValue}
          onFocus={handleFocus}
          onChange={handleChange}
        />
        {(autocomplete.fields.length > 0 ||
          autocomplete.operators.length > 0 ||
          (autocomplete.values && autocomplete.values.length > 0)) && (
          <div
            style={{
              position: 'absolute',
              zIndex: 100,
              top: 38,
              left: 0,
              background: '#fff',
              boxShadow: '0 2px 8px #0001',
              width: '100%',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid #ddd',
              maxHeight: 400,
              overflowY: 'auto',
            }}
          >
            {autocomplete.fields.map(f => (
              <div
                key={f.field}
                style={{
                  padding: '6px 14px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                }}
                onClick={() => handleFieldSelect(f)}
              >
                <span style={{color: '#176bdb', fontWeight: 600}}>
                  {f.field}
                </span>
                <span style={{fontSize: 12, color: '#888', marginLeft: 6}}>
                  ({f.type})
                </span>
              </div>
            ))}

            {autocomplete.operators.length > 0 && (
              <div style={{borderTop: '1px solid #ddd'}}>
                {autocomplete.operators.map(op => (
                  <div
                    key={op.op}
                    style={{
                      padding: '6px 14px',
                      background: '#f8fafd',
                      cursor: 'pointer',
                    }}
                    title={op.description}
                    onClick={() => {
                      if (op.op === 'and' || op.op === 'or') {
                        handleLogicalOperatorSelect(op)
                      } else {
                        handleOperatorSelect(op)
                      }
                    }}
                  >
                    <div style={{display: 'flex'}}>
                      <span style={{color: '#263246', flex: 1}}>{op.op}</span>
                      <span style={{color: '#263246'}}>{op.label}</span>
                      <span
                        style={{fontSize: 11, color: '#aaa', marginLeft: 6}}
                      >
                        {op.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {autocomplete.values && autocomplete.values.length > 0 && (
              <div style={{borderTop: '1px solid #ddd', background: '#f7f7fa'}}>
                {autocomplete.values.map(v => (
                  <div
                    key={v}
                    style={{
                      padding: '6px 14px',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleValueSelect(v)}
                  >
                    <span style={{color: '#4a4a5a'}}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ToggleView
        loading={loading}
        onChangeTopN={ohChangeTopN}
        handleOnBlur={handleOnBlur}
        topN={topN}
        isMoreFetch={isMoreFetch}
        views={views.map(v => ({...v, props: v.props(data)}))}
      />
    </>
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
