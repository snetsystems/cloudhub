// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import WizardOverlay from 'src/reusable_ui/components/wizard/WizardOverlay'
import WizardStep from 'src/reusable_ui/components/wizard/WizardStep'
import DeviceConnectionStep from 'src/device_management/components/DeviceConnectionStep'
import SSHConnectionStep from 'src/device_management/components/SSHConnectionStep'
import DeviceManagementCompletionStep from 'src/device_management/components/DeviceManagementCompletionStep'

// Types
import {
  DeviceConnectionStatus,
  DeviceData,
  DropdownItem,
  Me,
  Notification,
  Organization,
  SNMPConfig,
  SNMPConnectionRequest,
  SSHConfig,
  SNMPConnectionSuccessDevice,
} from 'src/types'
import {NextReturn, ToggleWizard} from 'src/types/wizard'

// Constants
import {StepStatusKey} from 'src/reusable_ui/constants/wizard'
import {DEFAULT_NETWORK_DEVICE_DATA} from 'src/device_management/constants'

// API
import {
  createDevices,
  updateDevice,
  validateSNMPConnection,
} from 'src/device_management/apis/'

// Utils
import {convertDeviceDataOrganizationNameToID} from 'src/device_management/utils'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {
  notifyCreateDeviceFailed,
  notifyCreateDeviceSucceeded,
  notifySNMPConnectFailed,
  notifySNMPConnectSucceeded,
  notifyUpdateDeviceFailed,
  notifyUpdateDeviceSucceeded,
} from 'src/shared/copy/notifications'

interface Props {
  deviceConnectionStatus: DeviceConnectionStatus
  isUsingAuth: boolean
  isVisible: boolean
  me: Me
  organizations: Organization[]
  selectedDeviceData: DeviceData
  notify: (n: Notification) => void
  setDeviceManagementIsLoading: (isLoading: boolean) => void
  toggleVisibility: ToggleWizard
}

interface State {
  deviceData: DeviceData
  deviceSNMPConnectionStatus: StepStatusKey
  setupCompleteStatus: StepStatusKey
  sshConnectionStatus: StepStatusKey
}

@ErrorHandling
class DeviceConnection extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      deviceData:
        props.deviceConnectionStatus == 'Updating'
          ? props.selectedDeviceData
          : DEFAULT_NETWORK_DEVICE_DATA,
      deviceSNMPConnectionStatus: 'Incomplete',
      setupCompleteStatus: 'Incomplete',
      sshConnectionStatus: 'Incomplete',
    }
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.deviceConnectionStatus !== this.props.deviceConnectionStatus
    ) {
      if (this.props.deviceConnectionStatus === 'Updating') {
        this.setState({
          deviceData: this.props.selectedDeviceData,
          deviceSNMPConnectionStatus: 'Incomplete',
          setupCompleteStatus: 'Incomplete',
          sshConnectionStatus: 'Incomplete',
        })
      } else {
        this.setState({
          deviceData: DEFAULT_NETWORK_DEVICE_DATA,
          deviceSNMPConnectionStatus: 'Incomplete',
          setupCompleteStatus: 'Incomplete',
          sshConnectionStatus: 'Incomplete',
        })
      }
    }
  }

  public render() {
    const {
      deviceData,
      deviceSNMPConnectionStatus,
      setupCompleteStatus,
      sshConnectionStatus,
    } = this.state
    const {
      isUsingAuth,
      isVisible,
      me,
      organizations,
      toggleVisibility,
    } = this.props

    return (
      <WizardOverlay
        visible={isVisible}
        toggleVisibility={toggleVisibility}
        resetWizardState={this.handleResetWizard}
        title="Device Connection Configuration"
        maxWidth={800}
      >
        <WizardStep
          title="Device SNMP Connection"
          isComplete={() => this.isStatusComplete(deviceSNMPConnectionStatus)}
          isErrored={this.isStatusError(deviceSNMPConnectionStatus)}
          isSkippableStep={false}
          onNext={this.handleValidateSNMPConnection}
          nextLabel={'Next'}
        >
          <DeviceConnectionStep
            deviceData={deviceData}
            me={me}
            organizations={organizations}
            isUsingAuth={isUsingAuth}
            onChangeDeviceData={this.handleChangeDeviceData}
            onChooseDeviceDataDropdown={this.handleChooseDeviceDataDropdown}
          />
        </WizardStep>
        <WizardStep
          title="SSH Connection"
          isComplete={() => this.isStatusComplete(sshConnectionStatus)}
          isSkippableStep={false}
          isErrored={this.isStatusError(sshConnectionStatus)}
          nextLabel={'Next'}
          onNext={this.handleConnectSSH}
          previousLabel="Go Back"
          lastStep={true}
        >
          <SSHConnectionStep
            deviceData={deviceData}
            onChangeDeviceData={this.handleChangeDeviceData}
          />
        </WizardStep>

        <WizardStep
          title="Setup Complete"
          tipText="Setup Complete"
          isComplete={() => this.isStatusComplete(setupCompleteStatus)}
          isSkippableStep={false}
          isErrored={this.isStatusError(setupCompleteStatus)}
          onNext={this.handleCompleteSetup}
          nextLabel="Finish"
          previousLabel="Go Back"
        >
          <DeviceManagementCompletionStep />
        </WizardStep>
      </WizardOverlay>
    )
  }

  private handleResetWizard = () => {
    const {deviceConnectionStatus, selectedDeviceData} = this.props
    this.setState({
      deviceData:
        deviceConnectionStatus == 'Updating'
          ? selectedDeviceData
          : DEFAULT_NETWORK_DEVICE_DATA,
      deviceSNMPConnectionStatus: 'Incomplete',
      sshConnectionStatus: 'Incomplete',
      setupCompleteStatus: 'Incomplete',
    })
  }

  private handleValidateSNMPConnection = async (): Promise<NextReturn> => {
    const {deviceData} = this.state

    try {
      const snmpConfigData = this.generateSNMPConfig(deviceData)

      this.props.setDeviceManagementIsLoading(true)
      const {failed_requests, results} = await validateSNMPConnection(
        snmpConfigData
      )

      if (failed_requests && failed_requests.length > 0) {
        return this.handleSNMPConnectionError(failed_requests?.[0].errorMessage)
      }

      return this.handleSNMPConnectionSuccess(results)
    } catch (error) {
      return this.handleSNMPConnectionError(error.message)
    }
  }

  private generateSNMPConfig = (
    deviceData: DeviceData
  ): SNMPConnectionRequest[] => {
    const {device_ip, snmp_config} = deviceData
    const {community, port, version, protocol} = snmp_config

    return [
      {
        device_ip,
        community,
        port,
        version,
        protocol,
      },
    ]
  }

  private handleSNMPConnectionError = (errorMessage: string): NextReturn => {
    this.setState({deviceSNMPConnectionStatus: 'Error'})
    this.props.notify(notifySNMPConnectFailed(errorMessage))
    this.props.setDeviceManagementIsLoading(false)

    return {error: true, payload: {}}
  }

  private handleSNMPConnectionSuccess = (
    results: SNMPConnectionSuccessDevice[]
  ): NextReturn => {
    const {device_type, hostname, device_os} = results[0]

    this.setState(prevState => ({
      deviceData: {
        ...prevState.deviceData,
        device_type: device_type,
        hostname: hostname,
        device_os: device_os,
      },
      deviceSNMPConnectionStatus: 'Complete',
    }))
    this.props.notify(notifySNMPConnectSucceeded())
    this.props.setDeviceManagementIsLoading(false)

    return {error: false, payload: {}}
  }

  private handleConnectSSH = () => {
    // TODO Call Connect SSH Device API
    this.setState({sshConnectionStatus: 'Complete'})
    return {error: false, payload: {}}

    // TODO Connect SSH Error Handing
    // this.setState({sshConnectionStatus: 'Error'})
    // return {error: true, payload: {}}
  }

  private handleCompleteSetup = (): Promise<NextReturn> => {
    const {deviceConnectionStatus} = this.props

    if (deviceConnectionStatus === 'Creating') return this.createDevice()
    if (deviceConnectionStatus === 'Updating') return this.patchDevice()
  }

  private createDevice = async (): Promise<NextReturn> => {
    const {organizations} = this.props
    const {deviceData} = this.state

    try {
      const convertedDeviceData = convertDeviceDataOrganizationNameToID(
        [deviceData],
        organizations
      ) as DeviceData[]
      this.props.setDeviceManagementIsLoading(true)
      const {failed_devices} = await createDevices(convertedDeviceData)

      if (failed_devices && failed_devices.length > 0) {
        return this.handleCreateDevicesError(failed_devices?.[0].errorMessage)
      }

      return this.handleCreateDevicesSuccess()
    } catch (error) {
      return this.handleCreateDevicesError(error.message)
    }
  }

  private handleCreateDevicesError = (errorMessage: string): NextReturn => {
    this.setState({setupCompleteStatus: 'Error'})
    this.props.notify(notifyCreateDeviceFailed(errorMessage))
    this.props.setDeviceManagementIsLoading(false)

    return {error: true, payload: {}}
  }

  private handleCreateDevicesSuccess = (): NextReturn => {
    this.setState({setupCompleteStatus: 'Complete'})
    this.props.notify(notifyCreateDeviceSucceeded())
    this.props.setDeviceManagementIsLoading(false)

    return {error: false, payload: {}}
  }

  private patchDevice = async (): Promise<NextReturn> => {
    const {organizations} = this.props
    const {deviceData} = this.state
    const {id} = deviceData

    try {
      const convertedDeviceData = convertDeviceDataOrganizationNameToID(
        deviceData,
        organizations
      ) as DeviceData
      this.props.setDeviceManagementIsLoading(true)
      const {failed_devices} = await updateDevice({
        id,
        deviceData: convertedDeviceData,
      })

      if (failed_devices && failed_devices.length > 0) {
        return this.handleUpdateDevicesError(failed_devices?.[0].errorMessage)
      }

      return this.handleUpdateDevicesSuccess()
    } catch (error) {
      return this.handleUpdateDevicesError(error.message)
    }
  }

  private handleUpdateDevicesSuccess = (): NextReturn => {
    this.setState({setupCompleteStatus: 'Complete'})
    this.props.notify(notifyUpdateDeviceSucceeded())
    this.props.setDeviceManagementIsLoading(false)

    return {error: false, payload: {}}
  }

  private handleUpdateDevicesError = (errorMessage: string): NextReturn => {
    const _errorMessage = errorMessage ? errorMessage : ''

    this.setState({setupCompleteStatus: 'Error'})
    this.props.notify(notifyUpdateDeviceFailed(_errorMessage))
    this.props.setDeviceManagementIsLoading(false)

    return {error: true, payload: {}}
  }

  private handleChooseDeviceDataDropdown = (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: DropdownItem) => {
    this.setState(prevState => {
      const device = prevState.deviceData

      if (key in device.snmp_config) {
        return {
          deviceData: {
            ...device,
            snmp_config: {
              ...device.snmp_config,
              [key]: value.text,
            },
          },
        }
      } else if (device.ssh_config && key in device.ssh_config) {
        return {
          deviceData: {
            ...device,
            ssh_config: {
              ...device.ssh_config,
              [key]: value.text,
            },
          },
        }
      } else {
        return {
          deviceData: {
            ...device,
            [key]: value.text,
          },
        }
      }
    })
  }

  private handleChangeDeviceData = (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: string) => {
    let newValue: string | number = value

    this.setState(prevState => {
      const device = prevState.deviceData

      if (key === 'snmp_port') {
        newValue = Number(value)
        return {
          deviceData: {
            ...device,
            snmp_config: {
              ...device.snmp_config,
              port: newValue,
            },
          },
        }
      } else if (key === 'ssh_port') {
        newValue = Number(value)
        return {
          deviceData: {
            ...device,
            ssh_config: {
              ...device.ssh_config,
              port: newValue,
            },
          },
        }
      } else if (key in device.snmp_config) {
        return {
          deviceData: {
            ...device,
            snmp_config: {
              ...device.snmp_config,
              [key]: newValue,
            },
          },
        }
      } else if (device.ssh_config && key in device.ssh_config) {
        return {
          deviceData: {
            ...device,
            ssh_config: {
              ...device.ssh_config,
              [key]: newValue,
            },
          },
        }
      } else {
        return {
          deviceData: {
            ...device,
            [key]: newValue,
          },
        }
      }
    })
  }

  private isStatusComplete = (status: StepStatusKey) => {
    return status === 'Complete'
  }
  private isStatusError = (status: StepStatusKey) => {
    return status === 'Error'
  }
}

export default DeviceConnection
