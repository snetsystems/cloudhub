// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'

// Types
import {Source, DeviceData, SNMPConfig, SSHConfig} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  deviceData: DeviceData
  onChangeDeviceData: (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: string) => void
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
    const {deviceData, onChangeDeviceData} = this.props

    return (
      <>
        <WizardTextInput
          value={deviceData?.ssh_config?.ssh_user_name}
          label="Username"
          onChange={onChangeDeviceData('ssh_user_name')}
        />
        <WizardTextInput
          value={deviceData?.ssh_config?.ssh_password}
          label="Password"
          onChange={onChangeDeviceData('ssh_password')}
          type={'password'}
        />

        <WizardTextInput
          value={`${deviceData?.ssh_config?.ssh_port}`}
          label={'Port (Default: 22)'}
          type={'number'}
          onChange={onChangeDeviceData('ssh_port')}
        />
        <WizardTextInput
          value={`${deviceData?.ssh_config?.ssh_en_password}`}
          label={'Enable Password (Optional)'}
          type={'password'}
          onChange={onChangeDeviceData('ssh_en_password')}
        />
      </>
    )
  }
}
