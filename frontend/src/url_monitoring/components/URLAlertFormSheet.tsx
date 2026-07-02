import React, {useCallback, useEffect, useMemo, useState} from 'react'
import classnames from 'classnames'
import copy from 'copy-to-clipboard'
import {useDispatch} from 'react-redux'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {notify} from 'src/shared/actions/notifications'
import {
  notifyCopyToClipboardFailed,
  notifyCopyToClipboardSuccess,
} from 'src/shared/copy/notifications'

export interface URLAlertFormSheetItem {
  id: string
  name: string | string[]
  urls: string[]
}

export interface URLAlertFormSheetProps {
  isOpen: boolean
  onClose: () => void
  item: URLAlertFormSheetItem | null
}

const normalizeNames = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) {
    return value.map(name => String(name).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }
  return []
}

const buildNameUrlPairs = (item: URLAlertFormSheetItem | null) => {
  if (!item) return []

  const names = normalizeNames(item.name)
  const urls = item.urls ?? []
  const count = Math.max(names.length, urls.length, 1)

  return Array.from({length: count}, (_, index) => ({
    index: index + 1,
    name: names[index] ?? '--',
    url: urls[index] ?? '--',
  }))
}

export function URLAlertFormSheet({
  isOpen,
  onClose,
  item,
}: URLAlertFormSheetProps) {
  const dispatch = useDispatch()
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)

  const nameUrlPairs = useMemo(() => buildNameUrlPairs(item), [item])

  const handleCopyUrl = useCallback(
    (e: React.MouseEvent, url: string) => {
      e.stopPropagation()
      if (!url || url === '--') return

      const isSuccessful = copy(url)
      const preview = `${url.slice(0, 30).trimRight()}...`

      dispatch(
        notify(
          isSuccessful
            ? notifyCopyToClipboardSuccess(preview)
            : notifyCopyToClipboardFailed(preview)
        )
      )
    },
    [dispatch]
  )

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      requestAnimationFrame(() => setIsVisible(true))
      return
    }
    setIsVisible(false)
    const timer = window.setTimeout(() => setIsMounted(false), 250)
    return () => clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

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
          'modal-content url-monitoring-form-sheet url-alert-form-sheet',
          isVisible ? 'modal-content--open' : 'modal-content--closing'
        )}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="url-alert-sheet-title"
      >
        <div className="url-monitoring-form-sheet__header">
          <div className="url-monitoring-form-sheet__header-left">
            <h2
              id="url-alert-sheet-title"
              className="url-monitoring-form-sheet__title"
            >
              {item?.id ?? ''}
            </h2>
          </div>
        </div>

        <FancyScrollbar
          autoHide={false}
          className="url-monitoring-form-sheet__scroll"
        >
          <div className="url-monitoring-form-sheet__body">
            <div className="url-alert-form-sheet__targets">
              {nameUrlPairs.map(pair => (
                <div
                  key={pair.index}
                  className="url-alert-form-sheet__target-set"
                >
                  <div className="url-alert-form-sheet__target-index">
                    {pair.index}
                  </div>
                  <div className="url-alert-form-sheet__target-fields">
                    <div className="url-alert-form-sheet__target-field">
                      <span className="url-alert-form-sheet__target-label">
                        Name
                      </span>
                      <p
                        className="url-alert-form-sheet__target-value"
                        title={pair.name}
                      >
                        {pair.name}
                      </p>
                    </div>
                    <div className="url-alert-form-sheet__target-field">
                      <span className="url-alert-form-sheet__target-label">
                        URL
                      </span>
                      <div className="url-alert-form-sheet__target-url-row">
                        <p
                          className="url-alert-form-sheet__target-value url-alert-form-sheet__target-value--url"
                          title={pair.url}
                        >
                          {pair.url}
                        </p>
                        <button
                          type="button"
                          className="url-alert-form-sheet__copy-btn"
                          title="Copy to clipboard"
                          aria-label="Copy URL to clipboard"
                          disabled={pair.url === '--'}
                          onClick={e => handleCopyUrl(e, pair.url)}
                        >
                          <span className="icon copy" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FancyScrollbar>
      </div>
    </>
  )
}
