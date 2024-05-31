// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'

// Types
import {Source, DeviceData} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  deviceInformationForAddDevice: DeviceData
  onChangeDeviceData: (key: keyof DeviceData) => (value: string) => void
}

interface State {
  source: Partial<Source>
}

@ErrorHandling
export default class SSHConnectionStep extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {}
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {deviceInformationForAddDevice, onChangeDeviceData} = this.props

    return (
      <>
        <WizardTextInput
          value={deviceInformationForAddDevice.ssh_user_name}
          label="Username"
          onChange={onChangeDeviceData('ssh_user_name')}
        />
        <WizardTextInput
          value={deviceInformationForAddDevice.ssh_password}
          label="Password"
          onChange={onChangeDeviceData('ssh_password')}
          type={'password'}
        />

        <WizardTextInput
          value={`${deviceInformationForAddDevice.ssh_port}`}
          label={'SSH Port'}
          type={'number'}
          onChange={onChangeDeviceData('ssh_port')}
        />
        <WizardTextInput
          value={`${deviceInformationForAddDevice.ssh_en_password}`}
          label={'SSH Enable Password'}
          type={'password'}
          onChange={onChangeDeviceData('ssh_en_password')}
        />
      </>
    )
  }
}
