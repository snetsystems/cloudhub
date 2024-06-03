// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import Dropdown from 'src/shared/components/Dropdown'

// Constants
import {SNMP_VERSION, SNMP_PROTOCOL} from 'src/device_management/constants/'

// Types
import {
  Source,
  Me,
  Organization,
  DeviceData,
  DropdownItem,
  SNMPConfig,
  SSHConfig,
} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  deviceData: DeviceData
  isUsingAuth: boolean
  me: Me
  organizations: Organization[]
  onChangeDeviceData: (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: string) => void
  onChooseDeviceDataDropdown: (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: DropdownItem) => void
}

interface State {
  source: Partial<Source>
}

@ErrorHandling
export default class DeviceConnectionStep extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {}
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      deviceData,
      me,
      organizations,
      isUsingAuth,
      onChangeDeviceData,
      onChooseDeviceDataDropdown,
    } = this.props

    let dropdownCurOrg: any = null
    if (isUsingAuth) {
      dropdownCurOrg = [
        {
          ...me.currentOrganization,
          text: me.currentOrganization.name,
        },
      ]
    }

    let dropdownOrg: any = null
    if (organizations) {
      dropdownOrg = organizations.map(role => ({
        ...role,
        text: role.name,
      }))
    }

    return (
      <>
        <WizardTextInput
          value={deviceData?.device_ip}
          label="Device IP"
          onChange={onChangeDeviceData('device_ip')}
        />
        <WizardTextInput
          value={deviceData?.snmp_config?.snmp_community}
          label="SNMP Community"
          onChange={onChangeDeviceData('snmp_community')}
        />
        <div className="form-group col-xs-6">
          <label>Organization</label>
          <Dropdown
            items={!isUsingAuth || me.superAdmin ? dropdownOrg : dropdownCurOrg}
            onChoose={onChooseDeviceDataDropdown('organization')}
            selected={deviceData?.organization}
            className="dropdown-stretch"
          />
        </div>
        <div className="form-group col-xs-6">
          <label>SNMP Version</label>
          <Dropdown
            items={SNMP_VERSION}
            onChoose={onChooseDeviceDataDropdown('snmp_version')}
            selected={deviceData?.snmp_config?.snmp_version}
            className="dropdown-stretch"
          />
        </div>
        <div className="form-group col-xs-6">
          <label>Protocol</label>
          <Dropdown
            items={SNMP_PROTOCOL}
            onChoose={onChooseDeviceDataDropdown('snmp_protocol')}
            selected={deviceData?.snmp_config?.snmp_protocol}
            className="dropdown-stretch"
          />
        </div>
        <WizardTextInput
          value={`${deviceData.snmp_config.snmp_port}`}
          label={'SNMP Port'}
          type={'number'}
          onChange={onChangeDeviceData('snmp_port')}
        />
      </>
    )
  }
}
