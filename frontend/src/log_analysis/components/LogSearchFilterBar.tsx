import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {connect} from 'react-redux'
import {buildOpenSearchQuery} from 'dsl-builder'

import type {
  BaseElasticSearchData,
  FieldInfo,
  AutoCompleteResult,
} from 'src/types/elasticSearch'
import {
  fetchKibanaFieldList,
  getAutoCompleteResult,
} from 'src/log_analysis/apis'
import {
  OperatorMeta,
  LOGICAL_OPERATORS,
} from 'src/log_analysis/constants/search-filter'
import {
  ESRange,
  defaultTimeRange,
  extractKqlFromFilters,
  lowerToESRange,
} from 'src/log_analysis/util'

import {OuiIcon} from '@opensearch-project/oui'
import 'src/log_analysis/util/setupOUIIcons'
import SearchFilterItem from './SearchFilterItem'
import {CloudTimeRange} from 'src/clouds/types'
import {FilteredLogsForLogAnalysis} from 'src/types'
import {bindActionCreators} from 'redux'
import {
  addLogAnalysisKQLFilterClause,
  removeLogAnalysisKQLFilterClause,
  clearLogAnalysisMatchPhraseFilterClauses,
  clearLogAnalysisRangeFilterClauses,
} from 'src/log_analysis/actions'
import {Button, ComponentColor, ComponentSize} from 'src/reusable_ui'

interface ReduxState {
  app: {
    persisted: {
      esSource?: BaseElasticSearchData
      cloudTimeRange?: CloudTimeRange
    }
  }
  logAnalysisDashboard?: {
    filteredLogsForLogAnalysis: FilteredLogsForLogAnalysis
  }
}

interface StateProps {
  esSource?: BaseElasticSearchData
  cloudTimeRange?: CloudTimeRange
  filteredLogsForLogAnalysis?: FilteredLogsForLogAnalysis
}

interface DispatchProps {
  addKql: (kql, dsl) => void
  removeKql: () => void
  clearMatchPhraseFilters: () => void
  clearRangeFilters: () => void
}

type Props = StateProps & DispatchProps

function LogSearchFilterBar({
  esSource,
  cloudTimeRange,
  addKql,
  removeKql,
  clearMatchPhraseFilters,
  clearRangeFilters,
  filteredLogsForLogAnalysis,
}: Props) {
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [inputValue, setInputValue] = useState(() =>
    extractKqlFromFilters(filteredLogsForLogAnalysis || [])
  )
  const [autocomplete, setAutocomplete] = useState<AutoCompleteResult>({
    fields: [],
    operators: [],
    values: [],
  })
  const [activeIndex, setActiveIndex] = useState(-1)
  const [dropdownItems, setDropdownItems] = useState<any[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownMouseDown = useRef(false)

  const hasMatchPhraseOrRangeFilters = useMemo(() => {
    if (
      !filteredLogsForLogAnalysis ||
      filteredLogsForLogAnalysis.length === 0
    ) {
      return false
    }

    return filteredLogsForLogAnalysis.some(
      filter => 'match_phrase' in filter || 'range' in filter
    )
  }, [filteredLogsForLogAnalysis])

  useEffect(() => {
    setDropdownItems([
      ...autocomplete.fields.map(f => ({type: 'field', data: f})),
      ...autocomplete.operators.map(o => ({type: 'operator', data: o})),
      ...(autocomplete.values ?? []).map(v => ({type: 'value', data: v})),
    ])
    setActiveIndex(-1)
  }, [autocomplete])

  useEffect(() => {
    if (filteredLogsForLogAnalysis) {
      setInputValue(extractKqlFromFilters(filteredLogsForLogAnalysis))
    }
  }, [filteredLogsForLogAnalysis])

  useEffect(() => {
    const ops = autocomplete.operators.map(o => ({
      type: o.op === 'and' || o.op === 'or' ? 'logical' : 'operator',
      data: o,
    }))
    setDropdownItems([
      ...autocomplete.fields.map(f => ({type: 'field', data: f})),
      ...ops,
      ...(autocomplete.values ?? []).map(v => ({type: 'value', data: v})),
    ])
    setActiveIndex(-1)
  }, [autocomplete])

  useEffect(() => {
    if (!esSource || fields.length > 0) return
    ;(async () => {
      try {
        const {fields: fetched} = await fetchKibanaFieldList({esSource})
        setFields(fetched)
        triggerAC(inputValue, fetched)
      } catch (err) {
        setFields([])
      }
    })()
  }, [esSource, fields.length])

  const timeRange: ESRange = useMemo(() => {
    if (cloudTimeRange?.logAnalysis) {
      const {gteISO, lteISO} = lowerToESRange({
        lower: cloudTimeRange.logAnalysis.lower ?? defaultTimeRange.lower,
        upper: cloudTimeRange.logAnalysis.upper ?? 'now()',
      })
      return {gteISO, lteISO}
    }

    const lteISO = new Date().toISOString()
    const gteISO = new Date(Date.now() - 15 * 60_000).toISOString()
    return {gteISO, lteISO}
  }, [cloudTimeRange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || dropdownItems.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        submitFilter()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        setActiveIndex(i => (i + 1 < dropdownItems.length ? i + 1 : 0))
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        setActiveIndex(i => (i - 1 >= 0 ? i - 1 : dropdownItems.length - 1))
        break
      }
      case 'Escape': {
        e.preventDefault()
        setDropdownOpen(false)
        setActiveIndex(-1)
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (activeIndex === -1) {
          submitFilter()
        } else {
          const it = dropdownItems[activeIndex]
          if (it.type === 'field') handleFieldSelect(it.data)
          else if (it.type === 'operator') handleOperatorSelect(it.data)
          else if (it.type === 'logical') handleLogicalOperatorSelect(it.data)
          else handleValueSelect(it.data)
        }
        break
      }
    }
  }

  const getItemProps = (idx: number) => ({
    className: `kql-item${idx === activeIndex ? ' is-active' : ''}`,
    onMouseEnter: () => setActiveIndex(idx),
    onClick: () => {
      const it = dropdownItems[idx]
      if (it.type === 'field') handleFieldSelect(it.data)
      else if (it.type === 'operator') handleOperatorSelect(it.data)
      else if (it.type === 'logical') handleLogicalOperatorSelect(it.data)
      else handleValueSelect(it.data)
    },
  })

  const triggerAC = useCallback(
    async (value: string, useFields: FieldInfo[] = fields) => {
      if (!esSource || useFields.length === 0) return
      const res = await getAutoCompleteResult({
        input: value,
        allFields: useFields,
        esSource,
        timeRange,
      })
      setAutocomplete(res)
    },
    [esSource, fields, timeRange]
  )
  const handleFocus = async () => {
    if (!esSource) return
    setDropdownOpen(true)
    if (fields.length === 0) {
      const {fields: fetched} = await fetchKibanaFieldList({
        esSource,
      })

      setFields(fetched)
      triggerAC(inputValue, fetched)
    } else triggerAC(inputValue)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setInputValue(v)
    setDropdownOpen(true)
    triggerAC(v)
  }

  const handleBlur = () =>
    setTimeout(() => {
      if (dropdownMouseDown.current) {
        dropdownMouseDown.current = false
        inputRef.current?.focus()
      } else setDropdownOpen(false)
    }, 120)
  const handleMouseDown = () => (dropdownMouseDown.current = true)

  const RE_LOGICAL_PART = /(\b(?:and|or)\b\s*)[^ ]*$/i

  const handleFieldSelect = (f: FieldInfo) => {
    setInputValue(prev => {
      const replaced = prev.replace(
        RE_LOGICAL_PART,
        (_, op) => `${op}${f.field} `
      )
      return replaced === prev ? `${f.field} ` : replaced
    })

    setTimeout(() => triggerAC(`${f.field} `), 0)
  }
  const handleOperatorSelect = (op: OperatorMeta) => {
    setInputValue(p => p.trim() + ' ' + op.op + ' ')
    setTimeout(() => triggerAC(`${inputValue.trim()} ${op.op} `), 0)
  }
  const handleValueSelect = (raw: string) => {
    if (!raw) return
    const q = `"${raw.replace(/"/g, '\\"')}"`
    setInputValue(prev => prev.trimEnd() + ' ' + q + ' ')
    setAutocomplete({fields: [], operators: LOGICAL_OPERATORS, values: []})
    setDropdownOpen(true)
  }
  const handleLogicalOperatorSelect = (op: OperatorMeta) => {
    setInputValue(p => p.trim() + ' ' + op.op + ' ')
    setTimeout(() => triggerAC(''), 0)
  }

  const clearInput = () => {
    const trimmed = inputValue.trim()
    if (trimmed) removeKql()

    setInputValue('')
    setAutocomplete({fields: [], operators: [], values: []})
    setDropdownOpen(false)
    inputRef.current?.focus()
  }

  const submitFilter = () => {
    if (!esSource) return

    const indexPattern = {
      title: 'syslog-*',
      fields: fields.map(f => {
        return {
          name: f.field,
          type: f.type,
          esTypes: [f.type],
          searchable: f.searchable,
          filterable: f.searchable,
          aggregatable: f.aggregatable,
        }
      }),
    }

    const result = buildOpenSearchQuery(
      indexPattern,
      {
        query: inputValue.trim(),
        language: 'kuery',
      },
      [],
      {
        allowLeadingWildcards: true,
        queryStringOptions: undefined,
        ignoreFilterIfFieldNotInIndex: false,
      }
    )

    if (!inputValue) {
      removeKql()
      setDropdownOpen(false)
      return
    }

    addKql(inputValue, result)
    setDropdownOpen(false)
  }

  const filterClear = () => {
    if (!esSource) return
    clearMatchPhraseFilters()
    clearRangeFilters()
    setInputValue('')
    removeKql()
  }

  return (
    <div className="kql-filter-bar">
      <div className="kql-input-wrap">
        <button
          onClick={filterClear}
          className="filter-clear-btn btn button btn-sm btn-default"
          disabled={!hasMatchPhraseOrRangeFilters && inputValue.trim() === ''}
          title="Reset Filter"
        >
          <span className="icon trash" />
        </button>

        <div className="kql-box">
          <OuiIcon type="search" className="kql-icon-search" />

          <input
            id="kql-input"
            ref={inputRef}
            className="kql-input"
            value={inputValue}
            placeholder="Filter your data using KQL syntax"
            autoComplete="off"
            onFocus={handleFocus}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />

          {inputValue && (
            <button className="kql-clear-btn" onClick={clearInput}>
              <OuiIcon type="cross" size="s" />
            </button>
          )}

          <span className="kql-focus-bar" />
        </div>
        <Button
          customClass="kql-input-submit"
          size={ComponentSize.Small}
          color={ComponentColor.Primary}
          onClick={submitFilter}
          text="Search"
        />
      </div>

      {dropdownOpen && dropdownItems.length > 0 && (
        <div className="kql-dropdown" onMouseDown={handleMouseDown}>
          {dropdownItems.map((it, idx) => {
            if (it.type === 'field')
              return (
                <SearchFilterItem
                  key={`f-${it.data.field}`}
                  iconType="kqlField"
                  label={
                    <>
                      <span className="kql-field">{it.data.field}</span>
                      <span className="kql-meta">({it.data.type})</span>
                    </>
                  }
                  itemProps={getItemProps(idx)}
                />
              )

            if (it.type === 'operator')
              return (
                <SearchFilterItem
                  key={`op-${it.data.op}`}
                  iconType="kqlOperand"
                  label={<span className="kql-op">{it.data.op}</span>}
                  description={
                    <>
                      <span className="kql-meta">{it.data.label}</span>{' '}
                      <span className="kql-desc">{it.data.description}</span>
                    </>
                  }
                  itemProps={getItemProps(idx)}
                />
              )

            if (it.type === 'logical')
              return (
                <SearchFilterItem
                  key={`log-${it.data.op}`}
                  iconType="kqlSelector"
                  label={<span className="kql-log">{it.data.op}</span>}
                  description={
                    <span className="kql-desc">{it.data.description}</span>
                  }
                  itemProps={getItemProps(idx)}
                />
              )

            return (
              <SearchFilterItem
                key={`v-${it.data}`}
                iconType="kqlValue"
                label={<span>{`"${it.data}"`}</span>}
                itemProps={getItemProps(idx)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

const mstp = (state: ReduxState): StateProps => ({
  esSource: state.app.persisted.esSource,
  cloudTimeRange: state.app.persisted.cloudTimeRange,
  filteredLogsForLogAnalysis:
    state.logAnalysisDashboard.filteredLogsForLogAnalysis,
})

const mdtp = dispatch =>
  bindActionCreators(
    {
      addKql: addLogAnalysisKQLFilterClause,
      removeKql: removeLogAnalysisKQLFilterClause,
      clearMatchPhraseFilters: clearLogAnalysisMatchPhraseFilterClauses,
      clearRangeFilters: clearLogAnalysisRangeFilterClauses,
    },
    dispatch
  )

export default connect(mstp, mdtp)(LogSearchFilterBar)
