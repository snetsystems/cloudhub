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
  authProtocolTextToValue,
  privProtocolTextToValue,
} from 'src/types'
import {NextReturn, ToggleWizard} from 'src/types/wizard'

// Constants
import {StepStatusKey} from 'src/reusable_ui/constants/wizard'
import {
  DEFAULT_NETWORK_DEVICE_DATA,
  DEFAULT_SNMP_CONFIG,
} from 'src/device_management/constants'

// API
import {
  createDevices,
  updateDevice,
  validateSNMPConnection,
} from 'src/device_management/apis/'

// Utils
import {
  convertDeviceDataOrganizationNameToID,
  parseErrorMessage,
} from 'src/device_management/utils'

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
  refreshStateForDeviceManagement: () => void
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
          ? this.fillMissingSNMPConfig(props.selectedDeviceData)
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
          deviceData: this.fillMissingSNMPConfig(this.props.selectedDeviceData),
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

  private fillMissingSNMPConfig = (deviceData: DeviceData): DeviceData => {
    return {
      ...deviceData,
      snmp_config: {
        ...deviceData.snmp_config,
        security_level:
          deviceData?.snmp_config?.security_level ||
          DEFAULT_SNMP_CONFIG.security_level,
        security_name:
          deviceData?.snmp_config?.security_name ||
          DEFAULT_SNMP_CONFIG.security_name,
        auth_protocol:
          deviceData?.snmp_config?.auth_protocol ||
          DEFAULT_SNMP_CONFIG.auth_protocol,
        auth_pass:
          deviceData?.snmp_config?.auth_pass || DEFAULT_SNMP_CONFIG.auth_pass,
        priv_protocol:
          deviceData?.snmp_config?.priv_protocol ||
          DEFAULT_SNMP_CONFIG.priv_protocol,
        priv_pass:
          deviceData?.snmp_config?.priv_pass || DEFAULT_SNMP_CONFIG.priv_pass,
      },
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
          maxHeightForFancyScrollbar={this.getWizardMaxHeight()}
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
          <DeviceManagementCompletionStep deviceData={deviceData} />
        </WizardStep>
      </WizardOverlay>
    )
  }

  private getWizardMaxHeight = () => {
    const {deviceData} = this.state
    const version = deviceData?.snmp_config?.version || '2c'
    const securityLevel = deviceData?.snmp_config?.security_level

    const securityLevelLower = securityLevel ? securityLevel.toLowerCase() : ''

    if (version === '1' || version === '2c') {
      return 260
    }

    if (version === '3') {
      if (securityLevelLower === 'noauthnopriv') {
        return 295
      } else if (securityLevelLower === 'authnopriv') {
        return 355
      } else if (securityLevelLower === 'authpriv') {
        return 410
      }
    }

    return 260
  }

  private handleResetWizard = () => {
    const {deviceConnectionStatus, selectedDeviceData} = this.props
    this.setState({
      deviceData:
        deviceConnectionStatus == 'Updating'
          ? this.fillMissingSNMPConfig(selectedDeviceData)
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
      return this.handleSNMPConnectionError(parseErrorMessage(error))
    }
  }

  private generateSNMPConfig = (
    deviceData: DeviceData
  ): SNMPConnectionRequest[] => {
    const {device_ip, snmp_config} = deviceData
    const {
      community,
      port,
      version,
      protocol,
      security_name,
      auth_protocol,
      auth_pass,
      priv_protocol,
      priv_pass,
      security_level,
    } = snmp_config

    const securityLevelLower = security_level
      ? security_level.toLowerCase()
      : ''

    const snmpRequest: SNMPConnectionRequest = {
      device_ip,
      community: version === '3' ? '' : community,
      port,
      version: version,
      protocol,
      security_level: version === '3' ? security_level : '',
      security_name: version === '3' ? security_name : '',
      auth_protocol:
        version === '3' && securityLevelLower !== 'noauthnopriv'
          ? auth_protocol
          : '',
      auth_pass:
        version === '3' && securityLevelLower !== 'noauthnopriv'
          ? auth_pass
          : '',
      priv_protocol:
        version === '3' && securityLevelLower === 'authpriv'
          ? priv_protocol
          : '',
      priv_pass:
        version === '3' && securityLevelLower === 'authpriv' ? priv_pass : '',
    }

    return [snmpRequest]
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

  private finalizeAPIResponse = () => {
    const {
      refreshStateForDeviceManagement,
      setDeviceManagementIsLoading,
    } = this.props

    setDeviceManagementIsLoading(false)
    refreshStateForDeviceManagement()
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
        deviceData,
        organizations
      ) as DeviceData
      this.props.setDeviceManagementIsLoading(true)
      const {failed_devices} = await createDevices([
        this.convertDeviceDataSNMPConfig(convertedDeviceData),
      ])

      if (failed_devices && failed_devices.length > 0) {
        return this.handleCreateDevicesError(failed_devices?.[0].errorMessage)
      }

      return this.handleCreateDevicesSuccess()
    } catch (error) {
      return this.handleCreateDevicesError(parseErrorMessage(error))
    }
  }

  private convertDeviceDataSNMPConfig = (
    deviceData: DeviceData
  ): DeviceData => {
    const {snmp_config} = deviceData
    const {version, security_level, community} = snmp_config

    const securityLevelLower = security_level
      ? security_level.toLowerCase()
      : ''

    return {
      ...deviceData,
      snmp_config: {
        ...snmp_config,
        community: version === '3' ? '' : community,
        security_level:
          version === '3' ? snmp_config.security_level || '' : '',
        security_name:
          version === '3' ? snmp_config.security_name || '' : '',
        auth_protocol:
          version === '3' && securityLevelLower !== 'noauthnopriv'
            ? snmp_config.auth_protocol || ''
            : '',
        auth_pass:
          version === '3' && securityLevelLower !== 'noauthnopriv'
            ? snmp_config.auth_pass || ''
            : '',
        priv_protocol:
          version === '3' && securityLevelLower === 'authpriv'
            ? snmp_config.priv_protocol || ''
            : '',
        priv_pass:
          version === '3' && securityLevelLower === 'authpriv'
            ? snmp_config.priv_pass || ''
            : '',
      },
    }
  }

  private handleCreateDevicesError = (errorMessage: string): NextReturn => {
    this.setState({setupCompleteStatus: 'Error'})
    this.props.notify(notifyCreateDeviceFailed(errorMessage))
    this.finalizeAPIResponse()

    return {error: true, payload: {}}
  }

  private handleCreateDevicesSuccess = (): NextReturn => {
    this.setState({setupCompleteStatus: 'Complete'})
    this.props.notify(notifyCreateDeviceSucceeded())
    this.finalizeAPIResponse()

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
        deviceData: this.convertDeviceDataSNMPConfig(convertedDeviceData),
      })

      if (failed_devices && failed_devices.length > 0) {
        return this.handleUpdateDevicesError(failed_devices?.[0].errorMessage)
      }

      return this.handleUpdateDevicesSuccess()
    } catch (error) {
      return this.handleUpdateDevicesError(parseErrorMessage(error))
    }
  }

  private handleUpdateDevicesSuccess = (): NextReturn => {
    this.setState({setupCompleteStatus: 'Complete'})
    this.props.notify(notifyUpdateDeviceSucceeded())
    this.finalizeAPIResponse()

    return {error: false, payload: {}}
  }

  private handleUpdateDevicesError = (errorMessage: string): NextReturn => {
    const _errorMessage = errorMessage ? errorMessage : ''

    this.setState({setupCompleteStatus: 'Error'})
    this.props.notify(notifyUpdateDeviceFailed(_errorMessage))
    this.finalizeAPIResponse()

    return {error: true, payload: {}}
  }

  private handleChooseDeviceDataDropdown = (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: DropdownItem) => {
    this.setState(prevState => {
      const device = prevState.deviceData

      if (key in device.snmp_config) {
        const newValue =
          key === 'auth_protocol'
            ? value.text
              ? authProtocolTextToValue[value.text]
              : ''
            : key === 'priv_protocol'
            ? value.text
              ? privProtocolTextToValue[value.text]
              : ''
            : value.text

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
