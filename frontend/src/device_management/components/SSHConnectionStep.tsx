// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import WizardNumberInput from 'src/reusable_ui/components/wizard/WizardNumberInput'

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
          value={deviceData?.ssh_config?.user_id}
          label="User ID"
          onChange={onChangeDeviceData('user_id')}
        />
        <WizardTextInput
          value={deviceData?.ssh_config?.password}
          label="Password"
          onChange={onChangeDeviceData('password')}
          type={'password'}
        />

        <WizardNumberInput
          value={`${deviceData?.ssh_config?.port}`}
          label={'Port (Default: 22)'}
          type={'number'}
          onChange={onChangeDeviceData('ssh_port')}
        />
        <WizardTextInput
          value={`${deviceData?.ssh_config?.en_password}`}
          label={'Enable Password (Optional)'}
          type={'password'}
          onChange={onChangeDeviceData('en_password')}
        />
      </>
    )
  }
}
