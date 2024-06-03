// Library
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import Papa from 'papaparse'

// Components
import AddDevicePage from 'src/device_management/components/AddDevicePage'
import ImportDevicePage from 'src/device_management/components/ImportDevicePage'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Constants
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {StepStatusKey} from 'src/reusable_ui/constants/wizard'
import {
  DEFAULT_DEVICE_DATA,
  IMPORT_DEVICE_CSV_Template,
  columns,
} from 'src/device_management/constants'

// Type
import {
  Me,
  Notification,
  Organization,
  DeviceData,
  ImportDevicePageStatus,
  DropdownItem,
  SNMPConfig,
  SSHConfig,
} from 'src/types'

// Util
import {downloadCSV} from 'src/shared/utils/downloadTimeseriesCSV'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {
  csvExportFailed,
  notifyCSVUploadFailed,
  notifyCSVUploadFailedWithMessage,
} from 'src/shared/copy/notifications'
import TableComponent from '../components/TableComponent'

interface Props {
  isUsingAuth: boolean
  me: Me
  organizations: Organization[]
  notify: (n: Notification) => void
}

interface State {
  addDeviceWizardVisibility: boolean
  importDeviceWizardVisibility: boolean
  deviceData: DeviceData[]
  deviceDataRawFromCSV: string
  deviceDataParsedFromCSV: Array<any>
  importDevicePageStatus: ImportDevicePageStatus
  deviceSNMPConnectionStatus: StepStatusKey
  setupCompleteStatus: StepStatusKey
  sshConnectionStatus: StepStatusKey
  checkedArray: string[]
}

const VERSION = process.env.npm_package_version

@ErrorHandling
class DeviceManagement extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      addDeviceWizardVisibility: false,
      importDeviceWizardVisibility: false,
      deviceData: [DEFAULT_DEVICE_DATA],
      deviceDataRawFromCSV: '',
      deviceDataParsedFromCSV: [],
      importDevicePageStatus: 'UploadCSV',
      deviceSNMPConnectionStatus: 'Incomplete',
      setupCompleteStatus: 'Incomplete',
      sshConnectionStatus: 'Incomplete',
      checkedArray: [],
    }
  }

  public render() {
    const {me, organizations, isUsingAuth} = this.props
    const {
      addDeviceWizardVisibility,
      deviceData,
      deviceDataRawFromCSV,
      importDevicePageStatus,
      importDeviceWizardVisibility,
      deviceSNMPConnectionStatus,
      setupCompleteStatus,
      sshConnectionStatus,
    } = this.state

    return (
      <>
        <TableComponent
          tableTitle={`${
            this.data.length
              ? this.data.length === 1
                ? '1 Device'
                : this.data.length + ' ' + 'Devices'
              : '0 Device'
          } list`}
          data={this.data}
          columns={this.column}
          setCheckedArray={(value: string[]) =>
            this.setState({checkedArray: value})
          }
          topLeftRender={
            <div className="device-management-top left">
              <div className="space-x">
                <Authorized requiredRole={EDITOR_ROLE}>
                  <div
                    onClick={this.addDevice(true)}
                    className="btn btn-sm btn-primary"
                  >
                    <span className="icon plus" /> Add Device
                  </div>
                </Authorized>
                {/* TODO Consder requiredRole */}
                <Authorized requiredRole={EDITOR_ROLE}>
                  <div
                    onClick={this.importDevice}
                    className="btn btn-sm btn-primary"
                  >
                    <span className="icon import" /> Import Device
                  </div>
                </Authorized>
              </div>
              <div className="space-x">
                <Authorized requiredRole={EDITOR_ROLE}>
                  <div
                    onClick={this.addDevice(true)}
                    className="btn btn-sm btn-primary"
                  >
                    <span className="icon plus" /> Add Device
                  </div>
                </Authorized>
                {/* TODO Consder requiredRole */}
                <Authorized requiredRole={EDITOR_ROLE}>
                  <div
                    onClick={this.importDevice}
                    className="btn btn-sm btn-primary"
                  >
                    <span className="icon import" /> Import Device
                  </div>
                </Authorized>
              </div>
            </div>
          }
        />
        <AddDevicePage
          me={me}
          organizations={organizations}
          onChangeDeviceData={this.handleChangeDeviceData}
          onChooseDeviceDataDropdown={this.handleChooseDeviceDataDropdown}
          onConnectDevice={this.handleConnectDevice}
          onConnectSSH={this.handleConnectSSH}
          onCompleteSetup={this.handleCompleteSetup}
          onResetWizard={this.handleResetWizard}
          deviceData={deviceData[0]}
          deviceSNMPConnectionStatus={deviceSNMPConnectionStatus}
          sshConnectionStatus={sshConnectionStatus}
          setupCompleteStatus={setupCompleteStatus}
          isUsingAuth={isUsingAuth}
          isVisible={addDeviceWizardVisibility}
          toggleVisibility={this.addDevice}
        />
        <ImportDevicePage
          deviceDataRawFromCSV={deviceDataRawFromCSV}
          importDevicePageStatus={importDevicePageStatus}
          isVisible={importDeviceWizardVisibility}
          onDismissOverlay={this.handleDismissImportDeviceModalOverlay}
          onDownloadCSVDeviceTemplate={this.handleDownloadCSVDeviceTemplate}
          onGoBackImportedDeviceFile={this.handleGoBackImportedDeviceFile}
          onGoNextImportedDeviceFile={this.handleGoNextImportedDeviceFile}
          onSaveImportedDeviceFile={this.handleSaveImportedDeviceFile}
          onUploadImportedDeviceFile={this.handleUploadImportedDeviceFile}
        />
      </>
    )
  }

  private data = []

  private column = columns

  private addDevice = isAddDeviceModalVisible => () => {
    this.setState({
      addDeviceWizardVisibility: isAddDeviceModalVisible,
    })
  }

  private importDevice = () => {
    this.setState({
      importDeviceWizardVisibility: true,
    })
  }

  private handleChooseDeviceDataDropdown = (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: DropdownItem) => {
    this.setState(prevState => ({
      deviceData: prevState.deviceData.map((device, index) => {
        if (index === 0) {
          if (key in device.snmp_config) {
            return {
              ...device,
              snmp_config: {
                ...device.snmp_config,
                [key]: value.text,
              },
            }
          } else if (device.ssh_config && key in device.ssh_config) {
            return {
              ...device,
              ssh_config: {
                ...device.ssh_config,
                [key]: value.text,
              },
            }
          } else {
            return {
              ...device,
              [key]: value.text,
            }
          }
        }
        return device
      }),
    }))
  }

  private handleChangeDeviceData = (
    key: keyof DeviceData | keyof SNMPConfig | keyof SSHConfig
  ) => (value: string) => {
    let newValue: string | number = value

    if (key === 'snmp_port' || key === 'ssh_port') {
      newValue = Number(value)
    }

    this.setState(prevState => ({
      deviceData: prevState.deviceData.map((device, index) => {
        if (index === 0) {
          if (key in device.snmp_config) {
            return {
              ...device,
              snmp_config: {
                ...device.snmp_config,
                [key]: newValue,
              },
            }
          } else if (device.ssh_config && key in device.ssh_config) {
            return {
              ...device,
              ssh_config: {
                ...device.ssh_config,
                [key]: newValue,
              },
            }
          } else {
            return {
              ...device,
              [key]: newValue,
            }
          }
        }
        return device
      }),
    }))
  }

  private handleDismissImportDeviceModalOverlay = (): void => {
    this.setState({
      deviceDataRawFromCSV: '',
      deviceDataParsedFromCSV: [],
      importDevicePageStatus: 'UploadCSV',
      importDeviceWizardVisibility: false,
    })
  }

  private handleDownloadCSVDeviceTemplate = (): void => {
    const deciceManagementTemplate = IMPORT_DEVICE_CSV_Template

    try {
      downloadCSV(deciceManagementTemplate, 'Device_Management_Template')
    } catch {
      this.props.notify(csvExportFailed)
    }
  }

  private handleGoBackImportedDeviceFile = () => {
    this.setState({
      deviceDataRawFromCSV: '',
      deviceDataParsedFromCSV: [],
      importDevicePageStatus: 'UploadCSV',
    })
  }

  private handleGoNextImportedDeviceFile = () => {
    this.setState({importDevicePageStatus: 'DeviceStatus'})
  }

  private handleSaveImportedDeviceFile = () => {
    // TODO Call Save Device File API
  }

  private handleUploadImportedDeviceFile = (
    uploadContent: string,
    fileName: string
  ): void => {
    const fileExtensionRegex = new RegExp(`${this.validFileExtension}$`)
    if (!fileName.match(fileExtensionRegex)) {
      this.props.notify(notifyCSVUploadFailed())
      return
    }

    this.setState({deviceDataRawFromCSV: uploadContent})

    this.getRefinedDeviceInformation(uploadContent)
  }

  private get validFileExtension(): string {
    return '.csv'
  }

  private getRefinedDeviceInformation(deviceDataRawFromCSV) {
    const {notify} = this.props

    Papa.parse(deviceDataRawFromCSV, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      beforeFirstChunk: chunk => {
        const rows = chunk.split(/\r\n|\r|\n/)
        const headers = rows[0]
        rows[0] = headers
          .split(',')
          .map(header => header.trim())
          .join(',')
        return rows.join('\n')
      },
      transform: value => {
        return value.trim()
      },
      complete: result => {
        this.setState({deviceDataParsedFromCSV: result?.data})
      },
      error: error => {
        notify(notifyCSVUploadFailedWithMessage(error.message))
      },
    })
  }

  private handleResetWizard = () => {
    // TODO Reset Wizard
    this.setState({
      deviceData: [DEFAULT_DEVICE_DATA],
      deviceDataRawFromCSV: '',
      deviceDataParsedFromCSV: [],
      deviceSNMPConnectionStatus: 'Incomplete',
      sshConnectionStatus: 'Incomplete',
      setupCompleteStatus: 'Incomplete',
    })
  }

  private handleConnectDevice = () => {
    // TODO Call Connect Device API

    this.setState({deviceSNMPConnectionStatus: 'Complete'})
    return {error: false, payload: {}}

    // TODO Connect Device API Error Handing
    // this.setState({deviceSNMPConnectionStatus: 'Error'})
    // return {error: true, payload: {}}
  }

  private handleConnectSSH = () => {
    // TODO Call Connect SSH Device API
    this.setState({sshConnectionStatus: 'Complete'})
    return {error: false, payload: {}}

    // TODO Connect Device API Error Handing
    // this.setState({sshConnectionStatus: 'Error'})
    // return {error: true, payload: {}}
  }

  private handleCompleteSetup = () => {
    // TODO Call Compete Setup API
    this.setState({setupCompleteStatus: 'Complete'})
    return {error: false, payload: {}}

    // TODO Connect Device API Error Handing
    // this.setState({setupCompleteStatus: 'Error'})
    // return {error: true, payload: {}}
  }
}

const mstp = ({adminCloudHub: {organizations}, auth: {isUsingAuth, me}}) => ({
  organizations,
  isUsingAuth,
  me,
})

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(DeviceManagement)
