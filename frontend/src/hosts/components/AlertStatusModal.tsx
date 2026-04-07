import React from 'react'
import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
} from 'src/reusable_ui'
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
  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer maxWidth={640}>
        <OverlayHeading
          title={`Alert Status: ${host}`}
          onDismiss={onClose}
        />
        <OverlayBody>
          <div className="alert-status-modal-body">
            {/* TODO: 시계열 alert 이력 표시 (추후 구현) */}
            <div className="alert-status-modal-placeholder">
              <p>
                Current Status:{' '}
                <strong>{alertStatus?.currentLevel ?? 'unknown'}</strong>
              </p>
              <p className="alert-status-modal-notice">
                상세 이력 표시는 추후 구현 예정입니다.
              </p>
            </div>
          </div>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default AlertStatusModal
