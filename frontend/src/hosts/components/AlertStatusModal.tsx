import React from 'react'
import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Panel,
} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'
import {HostAlertStatus} from 'src/hosts/types/alertStatus'

interface Props {
  isVisible: boolean
  host: string
  alertStatus: HostAlertStatus | null
  onClose: () => void
}

const AlertStatusModal = ({
  isVisible,
  host,
  alertStatus,
  onClose,
}: Props): JSX.Element => {
  const currentLevel = alertStatus?.currentLevel ?? 'unknown'
  const history = alertStatus?.history ?? []

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer maxWidth={800}>
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
                      {history.map((hist, i) => (
                        <div key={i} className="alert-status-modal--event-item">
                          <div className="alert-status-modal--event-title-row">
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
                            <span className="alert-status-modal--event-time">
                              {new Date(hist.time).toLocaleString()}
                            </span>
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
                        </div>
                      ))}
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
