import React, {ChangeEvent, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {Input, InputType, ComponentSize} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {URLMonitoringTarget} from '../types'

interface Props {
  targets: URLMonitoringTarget[]
  selectedTargetIds: string[]
  onChange: (selectedTargetIds: string[]) => void
}

const getTargetId = (target: URLMonitoringTarget): string =>
  String(target.id ?? target.url)

const getTargetLabel = (target: URLMonitoringTarget): string => {
  const url = target.url?.trim() || ''
  const name = target.name?.trim() || ''
  if (name && url) {
    return `${name} (${url})`
  }
  return name || url
}

const URLTargetSelector: React.FC<Props> = ({
  targets,
  selectedTargetIds,
  onChange,
}) => {
  const {t} = useTranslation()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim()
    if (!needle) {
      return targets
    }
    return targets.filter(target => {
      const label = getTargetLabel(target).toLowerCase()
      return label.includes(needle)
    })
  }, [targets, search])

  const filteredIds = useMemo(() => filtered.map(getTargetId), [filtered])

  const allSelected =
    filtered.length > 0 &&
    filteredIds.every(id => selectedTargetIds.includes(id))
  const someSelected =
    filteredIds.some(id => selectedTargetIds.includes(id)) && !allSelected

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setSearch(e.target.value)
  }

  const handleToggle = (targetId: string): void => {
    if (selectedTargetIds.includes(targetId)) {
      onChange(selectedTargetIds.filter(id => id !== targetId))
    } else {
      onChange([...selectedTargetIds, targetId])
    }
  }

  const handleToggleAll = (): void => {
    if (allSelected) {
      onChange(selectedTargetIds.filter(id => !filteredIds.includes(id)))
    } else {
      onChange(Array.from(new Set([...selectedTargetIds, ...filteredIds])))
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
          placeholder={t('url_alert_setting.search_urls')}
        />
        <span className="device-group-host-selector--count">
          {t('url_alert_setting.n_urls_selected', {
            count: selectedTargetIds.length,
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
              ? t('url_alert_setting.no_urls_search_results')
              : t('url_alert_setting.no_target_urls')}
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
            {filtered.map(target => {
              const targetId = getTargetId(target)
              const isSelected = selectedTargetIds.includes(targetId)
              return (
                <div
                  key={targetId}
                  className={`device-group-host-selector--item${
                    isSelected ? ' selected' : ''
                  }`}
                  onClick={() => handleToggle(targetId)}
                >
                  <span
                    className={`device-group-host-selector--checkbox${
                      isSelected ? ' checked' : ''
                    }`}
                  />
                  <span className="device-group-host-selector--hostname">
                    {getTargetLabel(target)}
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

export default URLTargetSelector
