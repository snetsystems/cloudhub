import React, {useCallback, useEffect, useMemo, useState} from 'react'
import classnames from 'classnames'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {SlideToggle, ComponentColor, ComponentSize} from 'src/reusable_ui'
import {DataTableObject} from 'src/types'

const REGIONS = [
  'California',
  'Frankfurt',
  'Jakarta',
  'Mumbai',
  'Seoul',
  'Singapore',
  'Tokyo',
] as const

export type UrlMonitoringSheetMode = 'add' | 'edit' | 'copy'

export interface UrlMonitoringFormSheetProps {
  isOpen: boolean
  onClose: () => void
  mode: UrlMonitoringSheetMode
  initialRow: DataTableObject | null
}

const COLLECTION_OPTIONS = [
  {value: '1m', label: '1분'},
  {value: '5m', label: '5분'},
  {value: '10m', label: '10분'},
  {value: '30m', label: '30분'},
  {value: '1h', label: '1시간'},
]

function matchRegionChip(region: string | undefined): Set<string> {
  if (!region) return new Set(['Seoul'])
  const r = region.trim()
  const found = REGIONS.find(
    x => x.toLowerCase() === r.toLowerCase() || r.includes(x)
  )
  return new Set(found ? [found] : ['Seoul'])
}

function defaultNameFromRow(row: DataTableObject): string {
  const s = row.server != null ? String(row.server) : ''
  if (s) return s
  const h = row.host != null ? String(row.host) : ''
  return h || ''
}

export function UrlMonitoringFormSheet({
  isOpen,
  onClose,
  mode,
  initialRow,
}: UrlMonitoringFormSheetProps) {
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)

  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(
    () => new Set(['Seoul'])
  )
  const [regionIpOpen, setRegionIpOpen] = useState(false)
  const [collectionPeriod, setCollectionPeriod] = useState('1m')

  const [eventSectionOpen, setEventSectionOpen] = useState(true)
  const [statusEventOn, setStatusEventOn] = useState(true)
  const [chkRequestError, setChkRequestError] = useState(true)
  const [chkServerError, setChkServerError] = useState(true)
  const [chkUnknown, setChkUnknown] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  const [elapsedEventOn, setElapsedEventOn] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(5)
  const [elapsedMessage, setElapsedMessage] = useState('')

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
      setSelectedRegions(new Set(['Seoul']))
      setCollectionPeriod('1m')
      setStatusEventOn(true)
      setChkRequestError(true)
      setChkServerError(true)
      setChkUnknown(false)
      setStatusMessage('')
      setElapsedEventOn(false)
      setElapsedSeconds(5)
      setElapsedMessage('')
      setRegionIpOpen(false)
      setEventSectionOpen(true)
      return
    }
    if (initialRow) {
      setName(defaultNameFromRow(initialRow))
      setUrl(String(initialRow.url ?? ''))
      setSelectedRegions(matchRegionChip(String(initialRow.region ?? '')))
      setCollectionPeriod('1m')
      setRegionIpOpen(false)
      setEventSectionOpen(true)
    }
  }, [isOpen, mode, initialRow])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const title = useMemo(() => {
    if (mode === 'edit') return 'URL 수정'
    if (mode === 'copy') return 'URL 복사'
    return 'URL 추가하기'
  }, [mode])

  const toggleRegion = useCallback((r: string) => {
    setSelectedRegions(prev => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }, [])

  const bumpElapsed = useCallback((delta: number) => {
    setElapsedSeconds(v => Math.min(300, Math.max(1, v + delta)))
  }, [])

  const handleSave = useCallback(() => {
    onClose()
  }, [onClose])

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
              title="닫기"
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
          <a
            className="url-monitoring-form-sheet__guide"
            href="/"
            onClick={e => e.preventDefault()}
          >
            가이드 바로가기
          </a>
        </div>

        <FancyScrollbar
          autoHide={false}
          style={{flex: 1, minHeight: 0}}
          className="url-monitoring-form-sheet__scroll"
        >
          <div className="url-monitoring-form-sheet__body">
            <label className="url-monitoring-form-sheet__field">
              <span className="url-monitoring-form-sheet__label">
                이름 <span className="url-monitoring-form-sheet__req">*</span>
              </span>
              <input
                type="text"
                className="url-monitoring-form-sheet__input"
                value={name}
                onChange={e => setName(e.target.value)}
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
              />
            </label>

            <div className="url-monitoring-form-sheet__field">
              <span className="url-monitoring-form-sheet__label">
                확인 지역{' '}
                <span className="url-monitoring-form-sheet__req">*</span>
              </span>
              <div className="url-monitoring-form-sheet__chips">
                {REGIONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    className={classnames('url-monitoring-form-sheet__chip', {
                      'url-monitoring-form-sheet__chip--active': selectedRegions.has(
                        r
                      ),
                    })}
                    onClick={() => toggleRegion(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="url-monitoring-form-sheet__collapse-trigger"
              onClick={() => setRegionIpOpen(v => !v)}
            >
              <span
                className={classnames('icon', {
                  'caret-right': !regionIpOpen,
                  'caret-down': regionIpOpen,
                })}
              />
              리전 IP
            </button>
            {regionIpOpen ? (
              <div className="url-monitoring-form-sheet__collapse-panel">
                <p className="url-monitoring-form-sheet__hint">
                  리전별 IP는 백엔드 연동 후 표시됩니다.
                </p>
              </div>
            ) : null}

            <label className="url-monitoring-form-sheet__field">
              <span className="url-monitoring-form-sheet__label">
                수집 주기{' '}
                <span className="url-monitoring-form-sheet__req">*</span>
              </span>
              <select
                className="url-monitoring-form-sheet__select"
                value={collectionPeriod}
                onChange={e => setCollectionPeriod(e.target.value)}
              >
                {COLLECTION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="url-monitoring-form-sheet__event-block">
              <button
                type="button"
                className="url-monitoring-form-sheet__event-header"
                onClick={() => setEventSectionOpen(v => !v)}
              >
                <span
                  className={classnames('icon', {
                    'caret-right': !eventSectionOpen,
                    'caret-down': eventSectionOpen,
                  })}
                />
                이벤트 설정
              </button>
              {eventSectionOpen ? (
                <div className="url-monitoring-form-sheet__event-body">
                  <div className="url-monitoring-form-sheet__event-row">
                    <span className="url-monitoring-form-sheet__subheading">
                      상태
                    </span>
                    <SlideToggle
                      active={statusEventOn}
                      onChange={() => setStatusEventOn(v => !v)}
                      size={ComponentSize.Small}
                      color={ComponentColor.Primary}
                    />
                  </div>
                  <div className="url-monitoring-form-sheet__checkboxes">
                    <div className="fixedmodal-checkbox-wrapper">
                      <input
                        type="checkbox"
                        id="url-monitoring-status-request-error"
                        checked={chkRequestError}
                        onChange={e => setChkRequestError(e.target.checked)}
                      />
                      <label
                        htmlFor="url-monitoring-status-request-error"
                        className="url-monitoring-form-sheet__check-label url-monitoring-form-sheet__check-label--request"
                      >
                        요청 오류
                      </label>
                    </div>
                    <div className="fixedmodal-checkbox-wrapper">
                      <input
                        type="checkbox"
                        id="url-monitoring-status-server-error"
                        checked={chkServerError}
                        onChange={e => setChkServerError(e.target.checked)}
                      />
                      <label
                        htmlFor="url-monitoring-status-server-error"
                        className="url-monitoring-form-sheet__check-label url-monitoring-form-sheet__check-label--server"
                      >
                        서버 오류
                      </label>
                    </div>
                    <div className="fixedmodal-checkbox-wrapper">
                      <input
                        type="checkbox"
                        id="url-monitoring-status-unknown"
                        checked={chkUnknown}
                        onChange={e => setChkUnknown(e.target.checked)}
                      />
                      <label
                        htmlFor="url-monitoring-status-unknown"
                        className="url-monitoring-form-sheet__check-label url-monitoring-form-sheet__check-label--unknown"
                      >
                        알수없음
                      </label>
                    </div>
                  </div>
                  <input
                    type="text"
                    className="url-monitoring-form-sheet__input"
                    placeholder="알림 메시지 (최대 50자)"
                    maxLength={50}
                    value={statusMessage}
                    onChange={e => setStatusMessage(e.target.value)}
                  />

                  <div className="url-monitoring-form-sheet__event-row url-monitoring-form-sheet__event-row--spaced">
                    <span className="url-monitoring-form-sheet__subheading">
                      경과 시간
                    </span>
                    <SlideToggle
                      active={elapsedEventOn}
                      onChange={() => setElapsedEventOn(v => !v)}
                      size={ComponentSize.Small}
                      color={ComponentColor.Default}
                    />
                  </div>
                  <div className="url-monitoring-form-sheet__stepper-row">
                    <div className="url-monitoring-form-sheet__stepper">
                      <button
                        type="button"
                        className="btn btn-xs btn-default"
                        onClick={() => bumpElapsed(-1)}
                      >
                        −
                      </button>
                      <span className="url-monitoring-form-sheet__stepper-value">
                        {elapsedSeconds}
                      </span>
                      <button
                        type="button"
                        className="btn btn-xs btn-default"
                        onClick={() => bumpElapsed(1)}
                      >
                        +
                      </button>
                    </div>
                    <span className="url-monitoring-form-sheet__accent-text">
                      {elapsedSeconds}초 이상
                    </span>
                  </div>
                  <p className="url-monitoring-form-sheet__help-accent">
                    입력값을 초과한 응답시간의 경우 알림 발생
                  </p>
                  <input
                    type="text"
                    className="url-monitoring-form-sheet__input"
                    placeholder="알림 메시지 (최대 50자)"
                    maxLength={50}
                    value={elapsedMessage}
                    onChange={e => setElapsedMessage(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </FancyScrollbar>

        <div className="url-monitoring-form-sheet__footer">
          <p className="url-monitoring-form-sheet__footer-note">
            추가/수정/복사한 URL이 목록에 반영되기까지 약 1분의 시간이
            소요됩니다.
          </p>
          <button
            type="button"
            className="url-monitoring-form-sheet__save"
            onClick={handleSave}
          >
            <span className="icon checkmark" />
            저장
          </button>
        </div>
      </div>
    </>
  )
}
