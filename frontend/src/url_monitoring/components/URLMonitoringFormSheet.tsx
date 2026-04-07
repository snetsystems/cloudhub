import React, {useCallback, useEffect, useMemo, useState} from 'react'
import classnames from 'classnames'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import {Notification} from 'src/types'
import {URLMonitoringTarget} from 'src/url_monitoring/types'
import {
  addURLMonitoringTarget,
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

const COLLECTION_OPTIONS = [
  {value: '1m', label: '1 min'},
  {value: '2m', label: '2 min'},
  {value: '5m', label: '5 min'},
  {value: '10m', label: '10 min'},
]

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
      return
    }
    if (initialTarget) {
      setName(initialTarget.name)
      setUrl(initialTarget.url)
      setCollectionInterval(initialTarget.interval ?? '1m')
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
      onSaved()
      onClose()
    } catch (e) {
      notify({
        type: 'error',
        icon: 'alert-triangle',
        duration: 10000,
        isHasHTML: false,
        message: `Failed to save URL monitoring target: ${e?.message ?? e}`,
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
        style={{width: '40vw', minWidth: 360, maxWidth: 720}}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="url-monitoring-sheet-title"
      >
        <div className="url-monitoring-form-sheet__header">
          <div className="url-monitoring-form-sheet__header-left">
            <button
              type="button"
              className="url-monitoring-form-sheet__close"
              title="Close"
              onClick={onClose}
            >
              <span className="icon remove" />
            </button>
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
          style={{flex: 1, minHeight: 0}}
          className="url-monitoring-form-sheet__scroll"
        >
          <div className="url-monitoring-form-sheet__body">
            <label className="url-monitoring-form-sheet__field">
              <span className="url-monitoring-form-sheet__label">
                Name <span className="url-monitoring-form-sheet__req">*</span>
              </span>
              <input
                type="text"
                className="url-monitoring-form-sheet__input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Production API"
              />
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

            <label className="url-monitoring-form-sheet__field">
              <span className="url-monitoring-form-sheet__label">
                Collection interval{' '}
                <span className="url-monitoring-form-sheet__req">*</span>
              </span>
              <select
                className="url-monitoring-form-sheet__select"
                value={collectionInterval}
                onChange={e => setCollectionInterval(e.target.value)}
              >
                {COLLECTION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </FancyScrollbar>

        <div className="url-monitoring-form-sheet__footer">
          <ConfirmButton
            icon="checkmark"
            text={isLoading ? 'Saving...' : 'Save'}
            confirmText="Confirm"
            confirmAction={() => void handleSave()}
            type="btn-default"
            size="btn-sm"
            position="top"
            disabled={isLoading || !name.trim() || !url.trim()}
            customClass="url-monitoring-form-sheet__save"
          />
        </div>
      </div>
    </>
  )
}
