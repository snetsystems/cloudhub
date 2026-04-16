import React, {useCallback, useEffect, useMemo, useState} from 'react'
import classnames from 'classnames'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import Dropdown from 'src/shared/components/Dropdown'
import {DropdownItem, Notification} from 'src/types'
import {URLMonitoringTarget} from 'src/url_monitoring/types'
import {
  addURLMonitoringTarget,
  getCloudhubAjaxErrorMessage,
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

const COLLECTION_INTERVAL_ITEMS: DropdownItem[] = [
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
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)
  const [isLoading, setIsLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [collectionInterval, setCollectionInterval] = useState('1m')

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

  const handleSave = useCallback(async () => {
    if (!name.trim()) return
    if (!url.trim()) return
    setNameError(null)
    setIsLoading(true)
    try {
      if (mode === 'edit' && initialTarget?.id) {
        await patchURLMonitoringTarget(initialTarget.id, {
          name,
          url,
          interval: collectionInterval,
        })
      } else {
        await addURLMonitoringTarget({name, url, interval: collectionInterval})
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
