// frontend/src/alert_group/components/AlertGroupTargetSection.tsx
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import classnames from 'classnames'
import {ComponentColor, ComponentSize, ComponentStatus} from 'src/reusable_ui'
import DropdownButton from 'src/reusable_ui/components/dropdowns/DropdownButton'
import {ClickOutside} from 'src/shared/components/ClickOutside'
import TargetSelector from 'src/shared/components/TargetSelector'
import {
  AlertGroupRule,
  RemoteDataState,
  Source,
  TargetSelectorItem,
  TargetSelectorText,
} from 'src/types'
import {proxy} from 'src/utils/queryUrlGenerator'
import {getDeep} from 'src/utils/wrappers'
import {getURLMonitoring} from 'src/url_monitoring/apis'
import {URLMonitoringTarget} from 'src/url_monitoring/types'

export type AlertTargetType = 'server' | 'url'

interface HostTagSeries {
  columns: string[]
  values: string[][]
}

interface Props {
  type?: AlertTargetType
  source: Source
  rule: AlertGroupRule
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

const loadHostItems = async (source: Source): Promise<TargetSelectorItem[]> => {
  if (!source || !source.links?.proxy) {
    return []
  }
  const {data} = await proxy({
    source: source.links.proxy,
    query: 'show tag values with key = "host"',
    db: source.telegraf,
  })
  const seriesList = getDeep<HostTagSeries[]>(data, 'results.[0].series', [])
  const names = new Set<string>()
  seriesList.forEach(s => {
    const valueIdx = s.columns.findIndex(c => c === 'value')
    if (valueIdx < 0) {
      return
    }
    s.values.forEach(v => {
      const name = v[valueIdx]
      if (typeof name === 'string' && name) {
        names.add(name)
      }
    })
  })
  return Array.from(names)
    .sort()
    .map(hostname => ({id: hostname, label: hostname}))
}

const getUrlTargetId = (target: URLMonitoringTarget): string =>
  String(target.id ?? target.url)

const getUrlTargetLabel = (target: URLMonitoringTarget): string => {
  const url = target.url?.trim() || ''
  const name = target.name?.trim() || ''
  if (name && url) {
    return `${name} (${url})`
  }
  return name || url
}

const loadUrlItems = async (): Promise<TargetSelectorItem[]> => {
  const config = await getURLMonitoring().catch(() => null)
  const targets = config?.targets ?? []
  return targets.map(target => ({
    id: getUrlTargetId(target),
    label: getUrlTargetLabel(target),
  }))
}

const AlertGroupTargetSection: React.FC<Props> = ({
  type = 'server',
  source,
  rule,
  onUpdateRule,
}) => {
  const {t} = useTranslation()
  const [items, setItems] = useState<TargetSelectorItem[]>([])
  const [itemsLoad, setItemsLoad] = useState(RemoteDataState.NotStarted)
  const [targetPickerOpen, setTargetPickerOpen] = useState(false)

  const isUrl = type === 'url'

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      setItemsLoad(RemoteDataState.Loading)
      try {
        const loaded = isUrl ? await loadUrlItems() : await loadHostItems(source)
        if (cancelled) {
          return
        }
        setItems(loaded)
        setItemsLoad(RemoteDataState.Done)
      } catch {
        if (cancelled) {
          return
        }
        setItems([])
        setItemsLoad(RemoteDataState.Error)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [isUrl, source?.id])

  const closeTargetPicker = useCallback((): void => {
    setTargetPickerOpen(false)
  }, [])

  const toggleTargetPicker = useCallback((): void => {
    setTargetPickerOpen(open => !open)
  }, [])

  const selectedIds = isUrl ? rule.urlTargetIds || [] : rule.hostnames || []

  const handleSelectionChange = useCallback(
    (selected: string[]): void => {
      onUpdateRule(isUrl ? {urlTargetIds: selected} : {hostnames: selected})
    },
    [isUrl, onUpdateRule]
  )

  const text = useMemo(() => {
    if (isUrl) {
      return {
        title: t('url_alert_setting.target_title'),
        label: t('url_alert_setting.target_url'),
        helperText: undefined as string | undefined,
        emptySelectLabel: t('url_alert_setting.select_url'),
        selectTitle: t('url_alert_setting.select_url_title'),
        loadErrorText: t('url_alert_setting.failed_to_load_targets'),
        selector: {
          searchPlaceholder: t('url_alert_setting.search_urls'),
          selectedCountText: t('url_alert_setting.n_urls_selected', {
            count: selectedIds.length,
            defaultValue: '{{count}}개 선택됨',
          }),
          emptyText: t('url_alert_setting.no_target_urls'),
          emptySearchText: t('url_alert_setting.no_urls_search_results'),
        } as TargetSelectorText,
      }
    }
    return {
      title: t('alert_group_rule.target_def_title'),
      label: t('alert_group_rule.target_server'),
      helperText: t('alert_group_rule.target_server_helper'),
      emptySelectLabel: t('alert_group_rule.select_server'),
      selectTitle: t('alert_group_rule.select_server_title'),
      loadErrorText: t('alert_group_rule.failed_to_load_hosts'),
      selector: undefined as TargetSelectorText | undefined,
    }
  }, [isUrl, t, selectedIds.length])

  const dropdownStatus =
    itemsLoad === RemoteDataState.Loading
      ? ComponentStatus.Loading
      : itemsLoad === RemoteDataState.Error
      ? ComponentStatus.Error
      : ComponentStatus.Default

  const targetTriggerLabel =
    selectedIds.length === 0
      ? text.emptySelectLabel
      : t('alert_group_rule.n_selected', {count: selectedIds.length})

  return (
    <div
      className={classnames('rule-section', {
        'url-alert-target-section': isUrl,
      })}
    >
      <h3 className="rule-section--heading">{text.title}</h3>
      <div className="rule-section--body">
        <div className="alert-group-setting-row rule-section--row-first">
          <div className="alert-group-setting-label">{text.label}</div>
          <div className="alert-group-setting-control">
            <div className="alert-group-setting-inputs">
              {itemsLoad === RemoteDataState.Error ? (
                <span className="alert-group-empty-text">
                  {text.loadErrorText}
                </span>
              ) : (
                <ClickOutside onClickOutside={closeTargetPicker}>
                  <div
                    className={classnames(
                      'dropdown dropdown-small dropdown-default',
                      'alert-group-target--dropdown-root'
                    )}
                  >
                    <DropdownButton
                      active={targetPickerOpen}
                      color={ComponentColor.Default}
                      size={ComponentSize.Small}
                      status={dropdownStatus}
                      onClick={toggleTargetPicker}
                      title={text.selectTitle}
                    >
                      {targetTriggerLabel}
                    </DropdownButton>
                    {targetPickerOpen && itemsLoad === RemoteDataState.Done && (
                      <div className="dropdown--menu-container dropdown--onyx alert-group-target--host-dropdown-menu">
                        <div className="alert-group-target--host-dropdown-menu-inner">
                          <TargetSelector
                            items={items}
                            selectedIds={selectedIds}
                            onChange={handleSelectionChange}
                            text={text.selector}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </ClickOutside>
              )}
            </div>
            {text.helperText ? (
              <p className="alert-group-setting-helper">{text.helperText}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AlertGroupTargetSection
