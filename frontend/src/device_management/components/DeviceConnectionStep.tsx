// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import Dropdown from 'src/shared/components/Dropdown'

// Constants
import {SNMP_VERSION} from 'src/device_management/constants/'

// Types
import {Source, Me, Organization, DeviceData, DropdownItem} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  deviceInformationForAddDevice: DeviceData
  isUsingAuth: boolean
  me: Me
  organizations: Organization[]
  onChangeDeviceData: (key: keyof DeviceData) => (value: string) => void
  onChooseDeviceDataDropdown: (
    key: keyof DeviceData
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
      deviceInformationForAddDevice,
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
          value={deviceInformationForAddDevice.device_ip}
          label="Device IP"
          onChange={onChangeDeviceData('device_ip')}
        />
        <WizardTextInput
          value={deviceInformationForAddDevice.snmp_str}
          label="SNMP Community"
          onChange={onChangeDeviceData('snmp_str')}
        />
        <div className="form-group col-xs-6">
          <label>Organization</label>
          <Dropdown
            items={!isUsingAuth || me.superAdmin ? dropdownOrg : dropdownCurOrg}
            onChoose={onChooseDeviceDataDropdown('organization')}
            selected={deviceInformationForAddDevice.organization}
            className="dropdown-stretch"
          />
        </div>
        <div className="form-group col-xs-6">
          <label>SNMP Version</label>
          <Dropdown
            items={SNMP_VERSION}
            onChoose={onChooseDeviceDataDropdown('snmp_ver')}
            selected={deviceInformationForAddDevice.snmp_ver}
            className="dropdown-stretch"
          />
        </div>
        <WizardTextInput
          value={`${deviceInformationForAddDevice.snmp_port}`}
          label={'SNMP Port'}
          type={'number'}
          onChange={onChangeDeviceData('snmp_port')}
        />
      </>
    )
  }
}
