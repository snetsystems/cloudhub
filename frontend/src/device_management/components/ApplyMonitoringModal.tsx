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
  ApplyMonitoringRequest,
  CollectingDevice,
  DeviceData,
  FailedDevice,
  Notification,
} from 'src/types'

// Constants
import {
  MONITORING_MODAL_INFO,
  deviceApplyMonitoringColumn,
} from 'src/device_management/constants'

// Utils
import {parseErrorMessage, selectedArrayById} from 'src/device_management/utils'

// API
import {applyMonitoring} from 'src/device_management/apis'

// ETC
import {
  notifyApplyMonitoringFailed,
  notifyApplyMonitoringSuccess,
} from 'src/shared/copy/notifications'

interface Props {
  deviceData: DeviceData[]
  isVisible: boolean
  onDismissOverlay: () => void
  notify: (n: Notification) => void
  setDeviceManagementIsLoading: (isLoading: boolean) => void
  initializeCheckedArray: () => void
  refreshStateForDeviceManagement: () => void
}

function ApplyMonitoringModal({
  deviceData,
  isVisible,
  refreshStateForDeviceManagement,
  onDismissOverlay,
  notify,
  setDeviceManagementIsLoading,
  initializeCheckedArray,
}: Props) {
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState<boolean>(true)
  const scrollMaxHeight = window.innerHeight * 0.4

  useEffect(() => {
    setIsMonitoringEnabled(true)
  }, [isVisible])

  const handleToggleMonitoringEnabled = () => {
    setIsMonitoringEnabled(!isMonitoringEnabled)
  }

  const applyMonitoringAJAX = async () => {
    const applyMonitoringRequest = convertDeviceDataToApplyMonitoringRequest(
      deviceData
    )

    setDeviceManagementIsLoading(true)

    try {
      const {failed_devices} = await applyMonitoring(applyMonitoringRequest)

      if (failed_devices && failed_devices.length > 0) {
        return handleApplyMonitoringErrorWithFailedDevices(failed_devices)
      }

      return handleApplyMonitoringSuccess()
    } catch (error) {
      return handleApplyMonitoringError(parseErrorMessage(error))
    }
  }

  const finalizeApplyMonitoringAPIResponse = () => {
    setDeviceManagementIsLoading(false)
    refreshStateForDeviceManagement()
    initializeCheckedArray()
    onDismissOverlay()
  }

  const convertDeviceDataToApplyMonitoringRequest = (
    devicesData: DeviceData[]
  ): ApplyMonitoringRequest => {
    const collecting_devices: CollectingDevice[] = devicesData.map(device => ({
      device_id: device.id || '0',
      is_collecting: isMonitoringEnabled,
      is_collecting_cfg_written: device.is_collecting_cfg_written || false,
    }))

    return {collecting_devices}
  }

  const handleApplyMonitoringError = (errorMessage: string) => {
    notify(notifyApplyMonitoringFailed(errorMessage))
    finalizeApplyMonitoringAPIResponse()
  }

  const handleApplyMonitoringErrorWithFailedDevices = (
    failedDevices: FailedDevice[] | null
  ) => {
    const failedMessage = getFailedDevicesErrorMessage(failedDevices)

    notify(notifyApplyMonitoringFailed(failedMessage))
    finalizeApplyMonitoringAPIResponse()
  }

  const getFailedDevicesErrorMessage = (
    failedDevices: FailedDevice[] | null
  ): string => {
    let messages = ''
    const limit = 5

    if (failedDevices) {
      messages = failedDevices
        .slice(0, limit)
        .map(device => {
          const deviceID = [device?.device_id]
          const failedDevice = selectedArrayById(deviceData, deviceID, 'id')
          const deviceIp = failedDevice?.[0]?.device_ip ?? 'Unknown Device'

          return `${deviceIp}: ${device.errorMessage}`
        })
        .join('; ')
    }

    if (failedDevices && failedDevices.length > limit) {
      messages += `;  Total ${failedDevices.length} devices failed.`
    }

    return `${messages}`
  }

  const handleApplyMonitoringSuccess = () => {
    notify(notifyApplyMonitoringSuccess())
    finalizeApplyMonitoringAPIResponse()
  }

  const getSlideToggleMarginTop = () => {
    if (deviceData.length <= 12) {
      return '-20px'
    } else {
      return '0px'
    }
  }

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer>
        <OverlayHeading
          title={'Apply Monitoring Confirm'}
          onDismiss={() => {
            onDismissOverlay()
          }}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <>
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
              <div
                className="form-control-static"
                style={{
                  justifyContent: 'left',
                  marginTop: getSlideToggleMarginTop(),
                  width: '183px',
                }}
              >
                <SlideToggle
                  active={isMonitoringEnabled}
                  onChange={handleToggleMonitoringEnabled}
                  size={ComponentSize.ExtraSmall}
                />
                <label style={{padding: '3px 0px 0px 5px'}}>
                  Enable Monitoring
                </label>
              </div>
            </Form.Element>
            <Form.Element>
              <div className="device-management-message">
                {MONITORING_MODAL_INFO.monitoringMessage}
              </div>
            </Form.Element>
            <Form.Footer>
              <Button
                color={ComponentColor.Primary}
                text={'Apply'}
                onClick={() => {
                  applyMonitoringAJAX()
                }}
              />

              <Button
                text={'Close'}
                onClick={() => {
                  onDismissOverlay()
                }}
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default ApplyMonitoringModal
