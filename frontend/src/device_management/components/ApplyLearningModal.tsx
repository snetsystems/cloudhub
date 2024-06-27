import React, {useEffect, useState} from 'react'

// Components
import {
  Button,
  ComponentColor,
  ComponentSize,
  Form,
  OverlayBody,
  OverlayContainer,
  OverlayHeading,
  OverlayTechnology,
  SlideToggle,
} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import TableComponent from 'src/device_management/components/TableComponent'

// Type
import {
  ApplyLearningEnableStatusRequest,
  DeviceData,
  FailedDevice,
  Notification,
  LearningDevice,
} from 'src/types'

// Constants
import {
  MONITORING_MODAL_INFO,
  deviceApplyMonitoringColumn,
} from 'src/device_management/constants'

// Utils
import {selectedArrayById} from 'src/device_management/utils'

// API
import {applyLearningEnableStatus} from 'src/device_management/apis'

// ETC
import {
  notifyApplyLearningEnableStatusSuccess,
  notifyApplyLearningEnableStatusFailed,
} from 'src/shared/copy/notifications'

interface Props {
  deviceData: DeviceData[]
  isVisible: boolean
  getDeviceAJAX: () => Promise<void>
  onDismissOverlay: () => void
  notify: (n: Notification) => void
  setDeviceManagementIsLoading: (isLoading: boolean) => void
  initializeCheckedArray: () => void
}

function ApplyLearningModal({
  deviceData,
  isVisible,
  getDeviceAJAX,
  onDismissOverlay,
  notify,
  setDeviceManagementIsLoading,
  initializeCheckedArray,
}: Props) {
  const [isLearningEnabled, setIsLearningEnabled] = useState<boolean>(true)
  const scrollMaxHeight = window.innerHeight * 0.4

  useEffect(() => {
    setIsLearningEnabled(true)
  }, [isVisible])

  const handleToggleLearningEnabledStatus = () => {
    setIsLearningEnabled(!isLearningEnabled)
  }

  const applyLearningEnableStatusAJAX = async () => {
    const applyLearningEnableStatusRequest = convertDeviceDataToApplyLearningEnableStatusRequest(
      deviceData
    )

    setDeviceManagementIsLoading(true)

    try {
      const {failed_devices} = await applyLearningEnableStatus(
        applyLearningEnableStatusRequest
      )

      if (failed_devices && failed_devices.length > 0) {
        return handleApplyLearningEnableStatusErrorWithFailedDevices(
          failed_devices
        )
      }

      return handleApplyLearningEnableStatusSuccess()
    } catch (error) {
      return handleApplyLearningEnableStatusError(error.message || '')
    }
  }

  const finalizeApplyLearningEnableStatusAPIResponse = () => {
    setDeviceManagementIsLoading(false)
    getDeviceAJAX()
    initializeCheckedArray()
    onDismissOverlay()
  }

  const convertDeviceDataToApplyLearningEnableStatusRequest = (
    devicesData: DeviceData[]
  ): ApplyLearningEnableStatusRequest => {
    const learning_devices: LearningDevice[] = devicesData.map(device => ({
      device_id: device.id || 0,
      is_learning: isLearningEnabled,
    }))

    return {learning_devices}
  }

  const handleApplyLearningEnableStatusError = (errorMessage: string) => {
    notify(notifyApplyLearningEnableStatusFailed(errorMessage))
    finalizeApplyLearningEnableStatusAPIResponse()
  }

  const handleApplyLearningEnableStatusErrorWithFailedDevices = (
    failedDevices: FailedDevice[]
  ) => {
    const failedMessage = getFailedDevicesErrorMessage(failedDevices)

    notify(notifyApplyLearningEnableStatusFailed(failedMessage))
    finalizeApplyLearningEnableStatusAPIResponse()
  }

  const getFailedDevicesErrorMessage = (
    failedDevices: FailedDevice[]
  ): string => {
    const limit = 5
    let messages = failedDevices
      .slice(0, limit)
      .map(device => {
        const deviceID = [device?.device_id]
        const failedDevice = selectedArrayById(deviceData, deviceID, 'id')
        const deviceIp = failedDevice?.[0]?.device_ip ?? 'Unknown Device'

        return `${deviceIp}: ${device.errorMessage}`
      })
      .join('.')

    if (failedDevices.length > limit) {
      messages += `Total ${failedDevices.length} devices failed`
    }

    return `${messages}`
  }

  const handleApplyLearningEnableStatusSuccess = () => {
    notify(notifyApplyLearningEnableStatusSuccess())
    finalizeApplyLearningEnableStatusAPIResponse()
  }

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer>
        <OverlayHeading
          title={'Edit Learning Model'}
          onDismiss={() => {
            onDismissOverlay()
          }}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    paddingBottom: '2px',
                  }}
                >
                  <label style={{padding: '3px 5px 0px 0px'}}>
                    Enable Learning
                  </label>
                  <div>
                    <SlideToggle
                      active={isLearningEnabled}
                      onChange={handleToggleLearningEnabledStatus}
                      size={ComponentSize.ExtraSmall}
                    />
                  </div>
                </div>
                <FancyScrollbar
                  autoHeight={true}
                  maxHeight={scrollMaxHeight}
                  children={
                    <TableComponent
                      data={deviceData}
                      tableTitle={'Device List'}
                      columns={deviceApplyMonitoringColumn}
                      isSearchDisplay={false}
                    />
                  }
                ></FancyScrollbar>
              </>
            </Form.Element>

            <Form.Element>
              <div className="device-management-message">
                {MONITORING_MODAL_INFO.learningMessage}
              </div>
            </Form.Element>
            <Form.Footer>
              <div style={{marginTop: '10px'}}>
                <Button
                  color={ComponentColor.Primary}
                  text={'Apply'}
                  onClick={() => {
                    applyLearningEnableStatusAJAX()
                  }}
                />

                <Button
                  text={'Cancel'}
                  onClick={() => {
                    onDismissOverlay()
                  }}
                />
              </div>
            </Form.Footer>
          </Form>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default ApplyLearningModal
