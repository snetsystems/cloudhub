// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import Dropdown from 'src/shared/components/Dropdown'

// Constants
import {
  SNMP_VERSION,
  SNMP_PROTOCOL,
  SecurityLevels,
  AuthProtocols,
  PrivProtocols,
} from 'src/device_management/constants/'

// Types
import {
  Source,
  Me,
  Organization,
  DeviceData,
  DropdownItem,
  SNMPConfig,
  SSHConfig,
  authProtocolValueToText,
  privProtocolValueToText,
  SecurityLevelMapping,
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
    const protocolDropdownStyle = this.getProtocolDropdownStyle(
      deviceData?.snmp_config?.version
    )

    return (
      <>
        <WizardTextInput
          value={deviceData?.device_ip}
          label="Device IP"
          onChange={onChangeDeviceData('device_ip')}
        />
        <WizardTextInput
          value={deviceData?.snmp_config?.community}
          label="Community"
          onChange={onChangeDeviceData('community')}
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
          <label>Version</label>
          <Dropdown
            items={SNMP_VERSION}
            onChoose={onChooseDeviceDataDropdown('version')}
            selected={deviceData?.snmp_config?.version}
            className="dropdown-stretch"
          />
        </div>
        <div className="form-group col-xs-6" style={protocolDropdownStyle}>
          <label>Protocol</label>
          <Dropdown
            items={SNMP_PROTOCOL}
            onChoose={onChooseDeviceDataDropdown('protocol')}
            selected={deviceData?.snmp_config?.protocol.toUpperCase()}
            className="dropdown-stretch"
          />
        </div>
        <WizardTextInput
          value={`${deviceData?.snmp_config?.port || 161}`}
          label={'Port (Default: 161)'}
          type={'number'}
          onChange={onChangeDeviceData('snmp_port')}
        />
        {deviceData?.snmp_config?.version === '3' && this.SNMPV3FormElement}
      </>
    )
  }

  private get SNMPV3FormElement() {
    const {
      deviceData,
      onChangeDeviceData,
      onChooseDeviceDataDropdown,
    } = this.props

    const securityLevel = deviceData?.snmp_config?.security_level
    const securityLevelLower = securityLevel ? securityLevel.toLowerCase() : ''
    const securityLevelDropdownStyle = this.getSecurityLevelDropdownStyle(
      securityLevelLower
    )
    const authenticationProtocolDropdownStyle = this.getAuthenticationProtocolDropdownStyle(
      securityLevelLower
    )
    const privacyProtocolDropdownStyle = this.getPrivacyProtocolDropdownStyle()

    return (
      <>
        <div className="form-group col-xs-6" style={securityLevelDropdownStyle}>
          <label>Security Level</label>
          <Dropdown
            items={SecurityLevels}
            onChoose={onChooseDeviceDataDropdown('security_level')}
            selected={SecurityLevelMapping[securityLevelLower]}
            className="dropdown-stretch"
          />
        </div>
        <WizardTextInput
          value={`${deviceData?.snmp_config?.security_name || ''}`}
          label={'Security User'}
          onChange={onChangeDeviceData('security_name')}
        />
        {securityLevelLower !== 'noauthnopriv' && (
          <>
            <div
              className="form-group col-xs-6"
              style={authenticationProtocolDropdownStyle}
            >
              <label>Authentication Protocol</label>
              <Dropdown
                items={AuthProtocols}
                onChoose={onChooseDeviceDataDropdown('auth_protocol')}
                selected={
                  authProtocolValueToText[
                    deviceData?.snmp_config?.auth_protocol || ''
                  ]
                }
                className="dropdown-stretch"
              />
            </div>
            <WizardTextInput
              type={'password'}
              value={`${deviceData?.snmp_config?.auth_pass || ''}`}
              label={'Authentication Password'}
              onChange={onChangeDeviceData('auth_pass')}
            />
          </>
        )}
        {securityLevelLower === 'authpriv' && (
          <>
            <div
              className="form-group col-xs-6"
              style={privacyProtocolDropdownStyle}
            >
              <label>Privacy Protocol</label>
              <Dropdown
                items={PrivProtocols}
                onChoose={onChooseDeviceDataDropdown('priv_protocol')}
                selected={
                  privProtocolValueToText[
                    deviceData?.snmp_config?.priv_protocol || ''
                  ]
                }
                className="dropdown-stretch"
              />
            </div>
            <WizardTextInput
              type={'password'}
              value={`${deviceData?.snmp_config?.priv_pass || ''}`}
              label={'Privacy Password'}
              onChange={onChangeDeviceData('priv_pass')}
            />
          </>
        )}
      </>
    )
  }

  private getProtocolDropdownStyle = (version: string) => {
    return version === '3' ? {} : {height: '100px'}
  }

  private getSecurityLevelDropdownStyle = (level: string) => {
    const levelLower = level ? level.toLowerCase() : ''

    switch (levelLower) {
      case 'noauthnopriv':
        return {height: '150px'}
      default:
        return {}
    }
  }

  private getAuthenticationProtocolDropdownStyle = (level: string) => {
    const levelLower = level ? level.toLowerCase() : ''

    switch (levelLower) {
      case 'authnopriv':
        return {height: '235px'}
      default:
        return {}
    }
  }

  private getPrivacyProtocolDropdownStyle = () => {
    return {height: '180px'}
  }
}
