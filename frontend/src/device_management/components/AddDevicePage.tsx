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
  DeviceData,
  DropdownItem,
  Me,
  Organization,
  SNMPConfig,
  SSHConfig,
} from 'src/types'
import {NextReturn, ToggleWizard} from 'src/types/wizard'

// Constants
import {StepStatusKey} from 'src/reusable_ui/constants/wizard'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  isUsingAuth: boolean
  isVisible: boolean
  me: Me
  organizations: Organization[]
  deviceData: DeviceData
  deviceSNMPConnectionStatus: StepStatusKey
  setupCompleteStatus: StepStatusKey
  sshConnectionStatus: StepStatusKey
  onChangeDeviceData: (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: string) => void
  onChooseDeviceDataDropdown: (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: DropdownItem) => void
  onCompleteSetup: () => NextReturn
  onConnectDevice: () => NextReturn
  onConnectSSH: () => NextReturn
  onResetWizard: () => void
  toggleVisibility: ToggleWizard
}

interface State {}

@ErrorHandling
class AddDevicePage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      isUsingAuth,
      isVisible,
      me,
      organizations,
      deviceData,
      deviceSNMPConnectionStatus,
      setupCompleteStatus,
      sshConnectionStatus,
      onChangeDeviceData,
      onChooseDeviceDataDropdown,
      onCompleteSetup,
      onConnectDevice,
      onConnectSSH,
      onResetWizard,
      toggleVisibility,
    } = this.props

    return (
      <WizardOverlay
        visible={isVisible}
        toggleVisibility={toggleVisibility}
        resetWizardState={onResetWizard}
        title="Device Connection Configuration
        "
        maxWidth={800}
      >
        <WizardStep
          title="Device SNMP Connection"
          isComplete={() => this.isStatusComplete(deviceSNMPConnectionStatus)}
          isErrored={this.isStatusError(deviceSNMPConnectionStatus)}
          isSkippableStep={false}
          onNext={onConnectDevice}
          nextLabel={'Next'}
        >
          <DeviceConnectionStep
            deviceData={deviceData}
            me={me}
            organizations={organizations}
            isUsingAuth={isUsingAuth}
            onChangeDeviceData={onChangeDeviceData}
            onChooseDeviceDataDropdown={onChooseDeviceDataDropdown}
          />
        </WizardStep>
        <WizardStep
          title="SSH Connection"
          isComplete={() => this.isStatusComplete(sshConnectionStatus)}
          isSkippableStep={false}
          isErrored={this.isStatusError(sshConnectionStatus)}
          nextLabel={'Next'}
          onNext={onConnectSSH}
          previousLabel="Go Back"
          lastStep={true}
        >
          <SSHConnectionStep
            deviceData={deviceData}
            onChangeDeviceData={onChangeDeviceData}
          />
        </WizardStep>

        <WizardStep
          title="Setup Complete"
          tipText="Setup Complete"
          isComplete={() => this.isStatusComplete(setupCompleteStatus)}
          isSkippableStep={false}
          isErrored={this.isStatusError(setupCompleteStatus)}
          onNext={onCompleteSetup}
          nextLabel="Finish"
          previousLabel="Go Back"
        >
          <DeviceManagementCompletionStep />
        </WizardStep>
      </WizardOverlay>
    )
  }

  private isStatusComplete = (status: StepStatusKey) => {
    return status === 'Complete'
  }
  private isStatusError = (status: StepStatusKey) => {
    return status === 'Error'
  }
}

export default AddDevicePage
