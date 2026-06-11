import React, {useState, useEffect} from 'react'
import {useSelector} from 'react-redux'
import {useTranslation} from 'react-i18next'
import {OverlayHeading, Panel} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import RightDrawerTechnology from 'src/reusable_ui/components/overlays/RightDrawerTechnology'
import {HostAlertStatus} from 'src/hosts/types/alertStatus'
import {Source, TimeZones} from 'src/types'
import AlertStatusTable from 'src/hosts/components/AlertStatusTable'

interface Props {
  isVisible: boolean
  source: Source
  host: string
  alertStatus: HostAlertStatus | null
  onClose: () => void
}

const AlertStatusModal = ({
  isVisible,
  source,
  host,
  alertStatus,
  onClose,
}: Props): JSX.Element => {
  const [expandedIndices, setExpandedIndices] = useState<
    Record<number, boolean>
  >({})

  useEffect(() => {
    if (!isVisible) {
      setExpandedIndices({})
    }
  }, [isVisible])

  const toggleExpand = (index: number) => {
    setExpandedIndices(prev => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  const timeZone = useSelector(
    (state: {app?: {persisted?: {timeZone?: TimeZones}}}) =>
      state.app?.persisted?.timeZone ?? TimeZones.Local
  )
  const {i18n} = useTranslation()

  const currentLevel = alertStatus?.currentLevel ?? 'unknown'
  const history = alertStatus?.history ?? []

  return (
    <RightDrawerTechnology
      isOpen={isVisible}
      onClose={onClose}
      className="alert-status-drawer"
    >
      <OverlayHeading title={`Alert Details: ${host}`} />
      <FancyScrollbar autoHide={false} className="alert-status-drawer__scroll">
        <div className="alert-status-drawer__body">
          <div className="alert-status-modal">
            <Panel>
              <Panel.Header title="Alert Information" />
              <Panel.Body>
                <div className="alert-status-modal--info-header">
                  <strong>Agent Name:</strong> {host} &nbsp; | &nbsp;
                  <strong>Current Level:</strong> {currentLevel}
                </div>

                {history.length > 0 ? (
                  <div className="alert-status-modal--events-container">
                    <strong>Active Events ({history.length}):</strong>
                    {history.map((hist, i) => {
                      const isExpanded = !!expandedIndices[i]
                      return (
                        <div key={i} className="alert-status-modal--event-item">
                          <div
                            className="alert-status-modal--event-title-row"
                            onClick={() => toggleExpand(i)}
                          >
                            <span className="alert-status-modal--event-title">
                              <span
                                className={`icon caret-${
                                  isExpanded ? 'up' : 'down'
                                }`}
                              />
                              <span
                                className={`icon ${
                                  hist.level === 'warn'
                                    ? 'warning'
                                    : hist.level === 'danger'
                                    ? 'cancel'
                                    : 'circle-thick'
                                }`}
                              />
                              [{hist.level.toUpperCase()}] {hist.alertName}
                            </span>
                            <div className="alert-status-modal--event-meta">
                              <span className="alert-status-modal--event-time">
                                {new Date(hist.time).toLocaleString(
                                  i18n.language === 'ko' ? 'ko-KR' : 'en-US',
                                  {
                                    timeZone:
                                      timeZone === TimeZones.UTC
                                        ? 'UTC'
                                        : undefined,
                                  }
                                )}
                              </span>
                            </div>
                          </div>
                          {hist.message && (
                            <div className="alert-status-modal--event-message">
                              <strong>Message: </strong> {hist.message}
                            </div>
                          )}
                          {typeof hist.value !== 'undefined' && (
                            <div className="alert-status-modal--event-value">
                              <strong>Value: </strong> {hist.value}
                            </div>
                          )}

                          {isExpanded && (
                            <AlertStatusTable
                              source={source}
                              host={host}
                              time={hist.time}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="alert-status-modal--empty-state">
                    No recent alert history.
                  </div>
                )}
              </Panel.Body>
            </Panel>
          </div>
        </div>
      </FancyScrollbar>
    </RightDrawerTechnology>
  )
}

export default AlertStatusModal
