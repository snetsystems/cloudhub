// frontend/src/shared/components/TargetSelector.tsx
import React, {ChangeEvent, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Input, InputType, ComponentSize} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

export interface TargetSelectorItem {
  id: string
  label: string
}

export interface TargetSelectorText {
  searchPlaceholder?: string
  selectedCountText?: string
  emptyText?: string
  emptySearchText?: string
}

interface Props {
  items: TargetSelectorItem[]
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  text?: TargetSelectorText
}

const TargetSelector: React.FC<Props> = ({
  items,
  selectedIds,
  onChange,
  text,
}) => {
  const {t} = useTranslation()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim()
    if (!needle) {
      return items
    }
    return items.filter(item => item.label.toLowerCase().includes(needle))
  }, [items, search])

  const filteredIds = useMemo(() => filtered.map(item => item.id), [filtered])

  const allSelected =
    filtered.length > 0 && filteredIds.every(id => selectedIds.includes(id))
  const someSelected =
    filteredIds.some(id => selectedIds.includes(id)) && !allSelected

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setSearch(e.target.value)
  }

  const handleToggle = (id: string): void => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selected => selected !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const handleToggleAll = (): void => {
    if (allSelected) {
      onChange(selectedIds.filter(id => !filteredIds.includes(id)))
    } else {
      onChange(Array.from(new Set([...selectedIds, ...filteredIds])))
    }
  }

  return (
    <div className="device-group-host-selector">
      <div className="device-group-host-selector--search">
        <Input
          value={search}
          onChange={handleSearchChange}
          type={InputType.Text}
          size={ComponentSize.Small}
          placeholder={
            text?.searchPlaceholder ??
            t('alert_group_rule.search_hosts', '호스트 검색...')
          }
        />
        <span className="device-group-host-selector--count">
          {text?.selectedCountText ??
            t('alert_group_rule.n_hosts_selected', {
              count: selectedIds.length,
              defaultValue: '{{count}}개 선택됨',
            })}
        </span>
      </div>
      <FancyScrollbar
        className="device-group-host-selector--list"
        style={{height: 'calc(100% - 30px)'}}
      >
        {filtered.length === 0 ? (
          <div className="device-group-host-selector--empty">
            {search
              ? text?.emptySearchText ??
                t(
                  'alert_group_rule.no_hosts_search_results',
                  '검색 결과가 없습니다.'
                )
              : text?.emptyText ??
                t('alert_group_rule.no_target_hosts', '대상 호스트가 없습니다.')}
          </div>
        ) : (
          <>
            <div
              className="device-group-host-selector--item device-group-host-selector--item__all"
              onClick={handleToggleAll}
            >
              <span
                className={`device-group-host-selector--checkbox${
                  allSelected
                    ? ' checked'
                    : someSelected
                    ? ' indeterminate'
                    : ''
                }`}
              />
              <span className="device-group-host-selector--hostname">
                {search
                  ? t('alert_group_rule.select_all_search_results', {
                      count: filtered.length,
                      defaultValue: '검색 결과 전체 선택 ({{count}}개)',
                    })
                  : t('alert_group_rule.select_all_with_count', {
                      count: filtered.length,
                      defaultValue: '전체 선택 ({{count}}개)',
                    })}
              </span>
            </div>
            {filtered.map(item => {
              const isSelected = selectedIds.includes(item.id)
              return (
                <div
                  key={item.id}
                  className={`device-group-host-selector--item${
                    isSelected ? ' selected' : ''
                  }`}
                  onClick={() => handleToggle(item.id)}
                >
                  <span
                    className={`device-group-host-selector--checkbox${
                      isSelected ? ' checked' : ''
                    }`}
                  />
                  <span className="device-group-host-selector--hostname">
                    {item.label}
                  </span>
                </div>
              )
            })}
          </>
        )}
      </FancyScrollbar>
    </div>
  )
}

export default TargetSelector
