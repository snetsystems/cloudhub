import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {connect} from 'react-redux'

import type {
  BaseElasticSearchData,
  FieldInfo,
  AutoCompleteResult,
} from 'src/types/elasticSearch'
import {fetchKibanaFieldList, getAutoCompleteResult} from '../apis'
import {OperatorMeta, LOGICAL_OPERATORS} from '../constants/search-filter'
import {ESRange, lowerToESRange} from '../util'

import {OuiIcon} from '@opensearch-project/oui'
import 'src/log_analysis/util/setupOUIIcons'
import SearchFilterItem from './SearchFilterItem'
import {CloudTimeRange} from 'src/clouds/types'
import {timeRanges} from 'src/shared/data/timeRanges'

interface ReduxState {
  app: {
    persisted: {
      esSource?: BaseElasticSearchData
      cloudTimeRange?: CloudTimeRange
    }
  }
}
interface StateProps {
  esSource?: BaseElasticSearchData
  cloudTimeRange?: CloudTimeRange
}

type Props = StateProps

function LogSearchFilterBar({esSource, cloudTimeRange}: Props) {
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [inputValue, setInputValue] = useState('')
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

  useEffect(() => {
    setDropdownItems([
      ...autocomplete.fields.map(f => ({type: 'field', data: f})),
      ...autocomplete.operators.map(o => ({type: 'operator', data: o})),
      ...(autocomplete.values ?? []).map(v => ({type: 'value', data: v})),
    ])
    setActiveIndex(-1)
  }, [autocomplete])

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

  const defaultTimeRange = timeRanges.find(i => i.inputValue === 'Past 30d')
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
    if (!dropdownOpen || dropdownItems.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i + 1 < dropdownItems.length ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i - 1 >= 0 ? i - 1 : dropdownItems.length - 1))
    } else if (e.key === 'Enter' && activeIndex !== -1) {
      e.preventDefault()
      const it = dropdownItems[activeIndex]
      if (it.type === 'field') handleFieldSelect(it.data)
      else if (it.type === 'operator') {
        ;(it.data.op === 'and' || it.data.op === 'or'
          ? handleLogicalOperatorSelect
          : handleOperatorSelect)(it.data)
      } else handleValueSelect(it.data)
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
      const {fields: fetched} = await fetchKibanaFieldList({esSource})
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

  const handleFieldSelect = (f: FieldInfo) => {
    setInputValue(prev => {
      const logical = prev.match(/(and|or)\s*$/i)
      if (logical) return prev.replace(/(and|or)\s*$/i, '$1 ') + f.field + ' '
      const m = prev.match(/^(.*?\b(?:and|or)\b\s*)$/i)
      return m ? m[1] + f.field + ' ' : f.field + ' '
    })
    setTimeout(() => triggerAC(`${f.field} `), 0)
  }
  const handleOperatorSelect = (op: OperatorMeta) => {
    setInputValue(p => p.trim() + ' ' + op.op + ' ')
    setTimeout(() => triggerAC(`${inputValue.trim()} ${op.op} `), 0)
  }
  const handleValueSelect = (v: string) => {
    const q = /[\s,:"]/g.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v
    setInputValue(p => p.trimEnd() + ' ' + q + ' ')
    setAutocomplete({fields: [], operators: LOGICAL_OPERATORS, values: []})
    setDropdownOpen(true)
  }
  const handleLogicalOperatorSelect = (op: OperatorMeta) => {
    setInputValue(p => p.trim() + ' ' + op.op + ' ')
    setTimeout(() => triggerAC(''), 0)
  }

  const clearInput = () => {
    setInputValue('')
    setAutocomplete({fields: [], operators: [], values: []})
    setDropdownOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="kql-filter-bar">
      <div className="kql-input-wrap">
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
})

export default connect(mstp)(LogSearchFilterBar)
