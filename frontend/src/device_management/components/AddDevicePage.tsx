// Libraries
import React, {PureComponent} from 'react'
import {withRouter, WithRouterProps} from 'react-router'
import _ from 'lodash'

// Components
import WizardOverlay from 'src/reusable_ui/components/wizard/WizardOverlay'
import WizardStep from 'src/reusable_ui/components/wizard/WizardStep'
import DeviceConnectionStep from 'src/device_management/components/DeviceConnectionStep'
import SSHConnectionStep from 'src/device_management/components/SSHConnectionStep'
import DeviceManagementCompletionStep from 'src/device_management/components/DeviceManagementCompletionStep'

// Types
import {DeviceData, DropdownItem, Me, Organization} from 'src/types'
import {NextReturn, ToggleWizard} from 'src/types/wizard'

// Constants
import {StepStatusKey} from 'src/reusable_ui/constants/wizard'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  isUsingAuth: boolean
  isVisible: boolean
  me: Me
  organizations: Organization[]
  deviceInformationForAddDevice: DeviceData
  deviceConnectionStatus: StepStatusKey
  setupCompleteStatus: StepStatusKey
  sshConnectionStatus: StepStatusKey
  onChangeDeviceData: (key: keyof DeviceData) => (value: string) => void
  onChooseDeviceDataDropdown: (
    key: keyof DeviceData
  ) => (value: DropdownItem) => void
  onCompleteSetup: () => NextReturn
  onConnectDevice: () => NextReturn
  onConnectSSH: () => NextReturn
  onResetWizard: () => void
  toggleVisibility: ToggleWizard
}

interface State {}

@ErrorHandling
class AddDevicePage extends PureComponent<Props & WithRouterProps, State> {
  constructor(props: Props & WithRouterProps) {
    super(props)
  }

  public render() {
    const {
      isUsingAuth,
      isVisible,
      me,
      organizations,
      deviceInformationForAddDevice,
      deviceConnectionStatus,
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
          title="Device Connection"
          tipText="Device Connection"
          isComplete={() => this.isStatusComplete(deviceConnectionStatus)}
          isErrored={this.isStatusError(deviceConnectionStatus)}
          isSkippableStep={false}
          onNext={onConnectDevice}
          nextLabel={'Next'}
        >
          {/* TODO Consider SourceStep Props */}
          {/* <SourceStep
            ref={c => (this.sourceStepRef = c)}
            setError={this.handleSetSourceError}
            source={source}
            me={me}
            organizations={organizations}
            isUsingAuth={isUsingAuth}
          /> */}
          <DeviceConnectionStep
            deviceInformationForAddDevice={deviceInformationForAddDevice}
            me={me}
            organizations={organizations}
            isUsingAuth={isUsingAuth}
            onChangeDeviceData={onChangeDeviceData}
            onChooseDeviceDataDropdown={onChooseDeviceDataDropdown}
          />
        </WizardStep>
        <WizardStep
          title="SSH Connection"
          tipText="SSH Connection"
          isComplete={() => this.isStatusComplete(sshConnectionStatus)}
          isSkippableStep={false}
          isErrored={this.isStatusError(sshConnectionStatus)}
          nextLabel={'Next'}
          onNext={onConnectSSH}
          previousLabel="Go Back"
          lastStep={true}
        >
          <SSHConnectionStep
            deviceInformationForAddDevice={deviceInformationForAddDevice}
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

export default withRouter(AddDevicePage)
