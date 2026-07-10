import React, {useCallback, useEffect, useMemo, useState} from 'react'
import classnames from 'classnames'
import {useTranslation} from 'react-i18next'
import {
  ComponentColor,
  ComponentSize,
  ComponentStatus,
} from 'src/reusable_ui'
import DropdownButton from 'src/reusable_ui/components/dropdowns/DropdownButton'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import Dropdown from 'src/shared/components/Dropdown'
import {ClickOutside} from 'src/shared/components/ClickOutside'
import TargetSelector from 'src/shared/components/TargetSelector'
import {
  AlertGroupRule,
  Notification,
  RemoteDataState,
} from 'src/types'
import {URLMonitoringTarget} from 'src/url_monitoring/types'
import {
  addURLMonitoringTarget,
  getCloudhubAjaxErrorMessage,
  getUrlAlertRules,
  patchURLMonitoringTarget,
} from 'src/url_monitoring/apis'

export type URLMonitoringSheetMode = 'add' | 'edit' | 'copy'

export interface URLMonitoringFormSheetProps {
  isOpen: boolean
  onClose: () => void
  mode: URLMonitoringSheetMode
  initialTarget: URLMonitoringTarget | null
  onSaved: () => void
  notify: (n: Notification) => void
}

const COLLECTION_INTERVAL_ITEMS = [
  {text: '1 min'},
  {text: '2 min'},
  {text: '5 min'},
  {text: '10 min'},
]

const INTERVAL_VALUE_BY_LABEL: Record<string, string> = {
  '1 min': '1m',
  '2 min': '2m',
  '5 min': '5m',
  '10 min': '10m',
}

const INTERVAL_LABEL_BY_VALUE: Record<string, string> = {
  '1m': '1 min',
  '2m': '2 min',
  '5m': '5 min',
  '10m': '10 min',
}

function intervalLabelForValue(value: string): string {
  return INTERVAL_LABEL_BY_VALUE[value] ?? value
}

export function URLMonitoringFormSheet({
  isOpen,
  onClose,
  mode,
  initialTarget,
  onSaved,
  notify,
}: URLMonitoringFormSheetProps) {
  const {t} = useTranslation()
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)
  const [isLoading, setIsLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [collectionInterval, setCollectionInterval] = useState('1m')
  const [alertRuleIds, setAlertRuleIds] = useState<string[]>([])
  const [alertRules, setAlertRules] = useState<AlertGroupRule[]>([])
  const [alertRulesLoad, setAlertRulesLoad] = useState(RemoteDataState.NotStarted)
  const [alertRulePickerOpen, setAlertRulePickerOpen] = useState(false)

  useEffect(() => {
    if (isOpen) return
    setAlertRuleIds([])
    setAlertRulePickerOpen(false)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      requestAnimationFrame(() => setIsVisible(true))
      return
    }
    setIsVisible(false)
    const t = window.setTimeout(() => setIsMounted(false), 250)
    return () => clearTimeout(t)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (mode === 'add') {
      setName('')
      setUrl('')
      setCollectionInterval('1m')
      setAlertRuleIds([])
      setNameError(null)
      return
    }
    if (initialTarget) {
      setName(initialTarget.name)
      setUrl(initialTarget.url)
      setCollectionInterval(initialTarget.interval ?? '1m')
      setNameError(null)
    }
  }, [isOpen, mode, initialTarget])

  useEffect(() => {
    if (!isOpen || alertRulesLoad !== RemoteDataState.Done) return

    if (mode === 'add') {
      return
    }

    if (!initialTarget) {
      setAlertRuleIds([])
      return
    }

    const knownIds = new Set(
      alertRules
        .map(rule => String(rule.id ?? '').trim())
        .filter(Boolean)
    )
    setAlertRuleIds(
      (initialTarget.alertRuleIds ?? []).filter(id => knownIds.has(id))
    )
  }, [isOpen, mode, initialTarget, alertRulesLoad, alertRules])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setAlertRulesLoad(RemoteDataState.Loading)
    getUrlAlertRules()
      .then(rules => {
        if (cancelled) return
        setAlertRules(rules)
        setAlertRulesLoad(RemoteDataState.Done)
      })
      .catch(() => {
        if (cancelled) return
        setAlertRules([])
        setAlertRulesLoad(RemoteDataState.Error)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const title = useMemo(() => {
    if (mode === 'edit') return 'Edit URL'
    if (mode === 'copy') return 'Copy URL'
    return 'Add URL'
  }, [mode])

  const alertRuleSelectorItems = useMemo(
    () =>
      alertRules
        .filter(rule => rule.id)
        .map(rule => ({
          id: String(rule.id).trim(),
          label: rule.name || String(rule.id).trim(),
        })),
    [alertRules]
  )

  const alertRuleSelectorText = useMemo(
    () => ({
      searchPlaceholder: t(
        'url_monitoring.search_alert_rules',
        'Search alert groups...'
      ),
      selectedCountText: t('alert_group_rule.n_selected', {
        count: alertRuleIds.length,
      }),
      emptyText: t(
        'url_monitoring.no_alert_rules',
        'No alert groups available'
      ),
      emptySearchText: t(
        'url_monitoring.no_alert_rules_search_results',
        'No matching alert groups'
      ),
    }),
    [alertRuleIds.length, t]
  )

  const closeAlertRulePicker = useCallback((): void => {
    setAlertRulePickerOpen(false)
  }, [])

  const toggleAlertRulePicker = useCallback((): void => {
    if (isLoading || alertRulesLoad !== RemoteDataState.Done) {
      return
    }
    setAlertRulePickerOpen(open => !open)
  }, [alertRulesLoad, isLoading])

  const alertRuleDropdownStatus =
    alertRulesLoad === RemoteDataState.Loading
      ? ComponentStatus.Loading
      : alertRulesLoad === RemoteDataState.Error
      ? ComponentStatus.Error
      : ComponentStatus.Default

  const alertRuleTriggerLabel =
    alertRuleIds.length === 0
      ? t('url_monitoring.alert_rules_not_mapped', 'Not mapped')
      : t('alert_group_rule.n_selected', {count: alertRuleIds.length})

  const handleSave = useCallback(async () => {
    if (!name.trim()) return
    if (!url.trim()) return
    setNameError(null)
    setIsLoading(true)
    try {
      const payload = {
        name,
        url,
        interval: collectionInterval,
        alertRuleIds,
      }
      if (mode === 'edit' && initialTarget?.id) {
        await patchURLMonitoringTarget(initialTarget.id, payload)
      } else {
        await addURLMonitoringTarget(payload)
      }
      notify({
        type: 'success',
        icon: 'checkmark',
        duration: 8000,
        isHasHTML: false,
        message:
          mode === 'edit'
            ? 'URL updated successfully.'
            : 'URL added successfully.',
      })
      onSaved()
      onClose()
    } catch (e) {
      if (e?.status === 409) {
        setNameError('name is already in use.')
        return
      }
      notify({
        type: 'error',
        icon: 'alert-triangle',
        duration: 10000,
        isHasHTML: false,
        message: getCloudhubAjaxErrorMessage(e),
      })
    } finally {
      setIsLoading(false)
    }
  }, [
    mode,
    initialTarget,
    name,
    url,
    collectionInterval,
    alertRuleIds,
    onSaved,
    onClose,
    notify,
  ])

  if (!isMounted) return null

  return (
    <>
      <div
        className={classnames('modal-wrapper', {
          'modal-wrapper--open': isVisible,
          'modal-wrapper--closing': !isVisible,
        })}
        onClick={onClose}
        role="presentation"
      />
      <div
        className={classnames(
          'modal-content url-monitoring-form-sheet',
          isVisible ? 'modal-content--open' : 'modal-content--closing'
        )}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="url-monitoring-sheet-title"
      >
        <div className="url-monitoring-form-sheet__header">
          <div className="url-monitoring-form-sheet__header-left">
            <h2
              id="url-monitoring-sheet-title"
              className="url-monitoring-form-sheet__title"
            >
              {title}
            </h2>
          </div>
        </div>

        <FancyScrollbar
          autoHide={false}
          className="url-monitoring-form-sheet__scroll"
        >
          <div className="url-monitoring-form-sheet__body">
            <label className="url-monitoring-form-sheet__field">
              <span className="url-monitoring-form-sheet__label">
                Name <span className="url-monitoring-form-sheet__req">*</span>
              </span>
              <input
                type="text"
                className={classnames('url-monitoring-form-sheet__input', {
                  'url-monitoring-form-sheet__input--error': !!nameError,
                })}
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  if (nameError) setNameError(null)
                }}
                placeholder="e.g. Production API"
              />
              {nameError && (
                <span className="url-monitoring-form-sheet__error-text">
                  {nameError}
                </span>
              )}
            </label>

            <label className="url-monitoring-form-sheet__field">
              <span className="url-monitoring-form-sheet__label">
                URL <span className="url-monitoring-form-sheet__req">*</span>
              </span>
              <textarea
                className="url-monitoring-form-sheet__textarea"
                rows={4}
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/api/health"
              />
            </label>

            <div className="url-monitoring-form-sheet__field">
              <span className="url-monitoring-form-sheet__label">
                Collection interval{' '}
                <span className="url-monitoring-form-sheet__req">*</span>
              </span>
              <Dropdown
                className="dropdown-stretch"
                items={COLLECTION_INTERVAL_ITEMS}
                selected={intervalLabelForValue(collectionInterval)}
                onChoose={item =>
                  setCollectionInterval(
                    INTERVAL_VALUE_BY_LABEL[item.text] ?? collectionInterval
                  )
                }
                disabled={isLoading}
                buttonSize="btn-sm"
                buttonColor="btn-default"
              />
            </div>

            <div className="url-monitoring-form-sheet__field">
              <span className="url-monitoring-form-sheet__label">
                Alert group <span>(optional)</span>
              </span>
              {alertRulesLoad === RemoteDataState.Error ? (
                <span className="url-monitoring-form-sheet__error-text">
                  Failed to load alert groups.
                </span>
              ) : (
                <ClickOutside onClickOutside={closeAlertRulePicker}>
                  <div
                    className={classnames(
                      'dropdown dropdown-small dropdown-default',
                      'alert-group-target--dropdown-root',
                      'url-monitoring-form-sheet__alert-rule-dropdown'
                    )}
                  >
                    <DropdownButton
                      active={alertRulePickerOpen}
                      color={ComponentColor.Default}
                      size={ComponentSize.Small}
                      status={alertRuleDropdownStatus}
                      onClick={toggleAlertRulePicker}
                      title={t(
                        'url_monitoring.select_alert_rules',
                        'Select alert groups'
                      )}
                    >
                      {alertRuleTriggerLabel}
                    </DropdownButton>
                    {alertRulePickerOpen &&
                      alertRulesLoad === RemoteDataState.Done && (
                        <div className="dropdown--menu-container dropdown--onyx alert-group-target--host-dropdown-menu">
                          <div className="alert-group-target--host-dropdown-menu-inner">
                            <TargetSelector
                              items={alertRuleSelectorItems}
                              selectedIds={alertRuleIds}
                              onChange={setAlertRuleIds}
                              text={alertRuleSelectorText}
                            />
                          </div>
                        </div>
                      )}
                  </div>
                </ClickOutside>
              )}
            </div>
          </div>
        </FancyScrollbar>

        <div className="url-monitoring-form-sheet__footer">
          <button
            type="button"
            className="url-monitoring-form-sheet__save"
            disabled={isLoading || !name.trim() || !url.trim()}
            onClick={() => void handleSave()}
          >
            <span className="icon checkmark" aria-hidden />
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
