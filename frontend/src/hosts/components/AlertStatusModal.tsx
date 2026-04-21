import React, {useState, useEffect} from 'react'
import {useSelector} from 'react-redux'
import {useTranslation} from 'react-i18next'
import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Panel,
} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'
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
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer maxWidth={1200}>
        <OverlayHeading title={`Alert Details: ${host}`} onDismiss={onClose} />
        <OverlayBody>
          <div className="alert-status-modal">
            <Panel>
              <Panel.Header title="Alert Information" />
              <Panel.Body>
                <div className="alert-status-modal--info-header">
                  <strong>Agent Name:</strong> {host} &nbsp; | &nbsp;
                  <strong>Current Level:</strong> {currentLevel}
                </div>

                {history.length > 0 ? (
                  <FancyScrollbar autoHeight={true} maxHeight={400}>
                    <div className="alert-status-modal--events-container">
                      <strong>Active Events ({history.length}):</strong>
                      {history.map((hist, i) => {
                        const isExpanded = !!expandedIndices[i]
                        return (
                          <div
                            key={i}
                            className="alert-status-modal--event-item"
                          >
                            <div
                              className="alert-status-modal--event-title-row"
                              onClick={() => toggleExpand(i)}
                            >
                              <span className="alert-status-modal--event-title">
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
                                <span
                                  className={`icon caret-${
                                    isExpanded ? 'up' : 'down'
                                  }`}
                                />
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
                  </FancyScrollbar>
                ) : (
                  <div className="alert-status-modal--empty-state">
                    No recent alert history.
                  </div>
                )}
              </Panel.Body>
            </Panel>

            {/* 2. Chart Placeholder */}
            {/* <Panel>
              <Panel.Header title="Alert Chart" />
              <Panel.Body>
                <div className="alert-status-modal--placeholder alert-status-modal--placeholder-chart">
                  <p>추후 Chart가 구현될 영역입니다.</p>
                </div>
              </Panel.Body>
            </Panel> */}

            {/* 3. Metadata Placeholder  */}
            {/* <Panel>
              <Panel.Header title="Meta Data" />
              <Panel.Body>
                <div className="alert-status-modal--placeholder alert-status-modal--placeholder-meta">
                  <p>추후 메타 데이터가 구현될 영역입니다.</p>
                </div>
              </Panel.Body>
            </Panel> */}
          </div>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default AlertStatusModal
