import React, {PureComponent} from 'react'
import _ from 'lodash'
import Papa from 'papaparse'

// Components
import DragAndDrop from 'src/shared/components/DragAndDrop'
import {
  Button,
  ComponentColor,
  ComponentStatus,
  Form,
  OverlayBody,
  OverlayContainer,
  OverlayHeading,
  OverlayTechnology,
} from 'src/reusable_ui'
import CSVDeviceTemplateExporter from 'src/device_management/components/CSVDeviceTemplateExporter'
import TableComponent from 'src/device_management/components/TableComponent'

// Constants
import {
  IMPORT_DEVICE_CSV_Template,
  IMPORT_FILE_DEVICE_STATUS_COLUMNS,
} from 'src/device_management/constants'

// Types
import {
  DataTableObject,
  DeviceData,
  ImportDevicePageStatus,
  Notification,
  SNMPConnectionRequest,
  SNMPConnectionSuccessDevice,
  FailedDevice,
  SNMPConnectionFailedDevice,
} from 'src/types'

// Utils
import {downloadCSV} from 'src/shared/utils/downloadTimeseriesCSV'

// API
import {createDevices, validateSNMPConnection} from 'src/device_management/apis'

import {ErrorHandling} from 'src/shared/decorators/errors'

import {
  csvExportFailed,
  notifyCSVUploadFailed,
  notifyCSVUploadFailedWithMessage,
  notifyCreateDevicesFailed,
  notifyCreateDevicesSucceeded,
  notifySNMPConnectFailed,
} from 'src/shared/copy/notifications'

interface Props {
  isVisible: boolean
  notify: (n: Notification) => void
  onDismissOverlay: () => void
}

interface State {
  deviceDataRawFromCSV: string
  devicesDataParsedFromCSV: Array<any>
  deviceStatusTableData: DataTableObject[]
  isDeviceDataSaveButtonEnabled: boolean
  importDevicePageStatus: ImportDevicePageStatus
  devicesData: [] | DeviceData[]
}

@ErrorHandling
class ImportDevicePage extends PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = {
      deviceDataRawFromCSV: '',
      devicesDataParsedFromCSV: [],
      deviceStatusTableData: [],
      importDevicePageStatus: 'UploadCSV',
      isDeviceDataSaveButtonEnabled: false,
      devicesData: [],
    }
  }

  public render() {
    const {isVisible} = this.props
    const {importDevicePageStatus} = this.state

    return (
      <>
        <OverlayTechnology visible={isVisible}>
          <OverlayContainer maxWidth={800}>
            {importDevicePageStatus === 'UploadCSV' && this.UploadCSV}
            {importDevicePageStatus === 'DeviceStatus' && this.deviceStatus}
          </OverlayContainer>
        </OverlayTechnology>
      </>
    )
  }

  private get UploadCSV(): JSX.Element {
    const {onDismissOverlay} = this.props
    const {deviceDataRawFromCSV} = this.state

    return (
      <>
        <OverlayHeading
          title={'Import Device File'}
          onDismiss={onDismissOverlay}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <>
                <div className="form-group col-xs-12">
                  <label style={{fontSize: '13px'}}>Upload a CSV File</label>
                  {this.csvDeviceTemplateExporter}
                  <DragAndDrop
                    submitText="Preview"
                    fileTypesToAccept={this.validFileExtension}
                    handleSubmit={this.handleUploadImportedDeviceFile}
                    submitOnDrop={true}
                    submitOnUpload={true}
                    compact={true}
                  />
                </div>
              </>
            </Form.Element>
            <Form.Footer>
              <Button
                status={
                  deviceDataRawFromCSV === ''
                    ? ComponentStatus.Disabled
                    : ComponentStatus.Default
                }
                text="Next"
                color={ComponentColor.Primary}
                onClick={this.handleGoNextImportedDeviceFile}
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </>
    )
  }

  private get csvDeviceTemplateExporter(): JSX.Element {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingBottom: '1%',
        }}
      >
        <CSVDeviceTemplateExporter
          onDownloadCSVDeviceTemplate={this.handleDownloadCSVDeviceTemplate}
        />
      </div>
    )
  }

  private handleDownloadCSVDeviceTemplate = (): void => {
    const deciceManagementTemplate = IMPORT_DEVICE_CSV_Template

    try {
      downloadCSV(deciceManagementTemplate, 'Device_Management_Template')
    } catch {
      this.props.notify(csvExportFailed)
    }
  }

  private get validFileExtension(): string {
    return '.csv'
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
        this.setState({devicesDataParsedFromCSV: result?.data})
      },
      error: error => {
        notify(notifyCSVUploadFailedWithMessage(error.message))
      },
    })
  }

  private handleGoNextImportedDeviceFile = () => {
    this.handleValidateSNMPConnection()
  }

  private handleValidateSNMPConnection = async () => {
    try {
      const snmpConfigs = this.generateSNMPConfigs()
      const {failed_requests, results} = await validateSNMPConnection(
        snmpConfigs
      )

      return this.handleSNMPConnection(failed_requests, results)
    } catch (error) {
      return this.handleSNMPConnectionError(error.message)
    }
  }

  private generateSNMPConfigs = (): SNMPConnectionRequest[] => {
    const {devicesDataParsedFromCSV} = this.state

    return devicesDataParsedFromCSV.map(snmpConfig => ({
      device_ip: snmpConfig?.device_ip,
      snmp_community: snmpConfig?.snmp_community,
      snmp_port: snmpConfig?.snmp_port,
      snmp_version: snmpConfig?.snmp_version,
      snmp_protocol: snmpConfig?.snmp_protocol,
    }))
  }

  private handleSNMPConnection = (
    failed_requests: SNMPConnectionFailedDevice[],
    snmpConnectionSuccessDevices: SNMPConnectionSuccessDevice[]
  ) => {
    const devicesData = this.generateDevicesData(snmpConnectionSuccessDevices)
    const deviceStatusTableData = this.convertSNMPResponseToTableData(
      failed_requests,
      snmpConnectionSuccessDevices
    )
    const isDeviceDataSaveButtonEnabled = this.shouldEnableDeviceSaveButton(
      snmpConnectionSuccessDevices
    )

    this.setState({
      importDevicePageStatus: 'DeviceStatus',
      isDeviceDataSaveButtonEnabled: isDeviceDataSaveButtonEnabled,
      deviceStatusTableData: deviceStatusTableData,
      devicesData: devicesData,
    })
  }

  private generateDevicesData = (
    snmpConnectionSuccessDevices: null | SNMPConnectionSuccessDevice[]
  ) => {
    const {devicesDataParsedFromCSV} = this.state
    const devicesData = devicesDataParsedFromCSV.map(deviceData => {
      const result = _.find(
        snmpConnectionSuccessDevices,
        snmpConnectionSuccessDevice =>
          snmpConnectionSuccessDevice.device_ip === deviceData.device_ip
      )
      return {
        organization: deviceData?.organization || '',
        device_ip: deviceData?.device_ip || '',
        hostname: result?.hostname || '',
        device_type: result?.device_type || '',
        device_category: 'network',
        device_os: result?.device_os || '',
        ssh_config: {
          ssh_user_name: deviceData?.ssh_user_name || '',
          ssh_password: deviceData?.ssh_password || '',
          ssh_en_password: deviceData?.ssh_en_password || '',
          ssh_port: deviceData?.ssh_port || 22,
        },
        snmp_config: {
          snmp_community: deviceData?.snmp_community || '',
          snmp_port: deviceData?.snmp_port || 161,
          snmp_version: deviceData?.snmp_version || '1',
          snmp_protocol: deviceData?.snmp_protocol || '',
        },
      }
    })

    return devicesData
  }

  private convertSNMPResponseToTableData = (
    failedDevices: SNMPConnectionFailedDevice[],
    snmpConnectionSuccessDevices: SNMPConnectionSuccessDevice[]
  ): DataTableObject[] => {
    const _failedDevices = failedDevices.map(
      (failedDevice: SNMPConnectionFailedDevice): DataTableObject => ({
        index: failedDevice.index,
        ip: failedDevice.device_ip,
        status: 'Failed',
        message: failedDevice.errorMessage,
      })
    )

    const successDevices =
      _.map(
        snmpConnectionSuccessDevices,
        (successDevice: SNMPConnectionSuccessDevice): DataTableObject => ({
          index: successDevice.index,
          ip: successDevice.device_ip,
          status: 'OK',
          message: 'Success',
        })
      ) || []

    return [..._failedDevices, ...successDevices]
  }

  private shouldEnableDeviceSaveButton = (
    snmpConnectionSuccessDevices: SNMPConnectionSuccessDevice[]
  ): boolean => {
    return (
      snmpConnectionSuccessDevices && snmpConnectionSuccessDevices.length > 0
    )
  }

  private handleSNMPConnectionError = (errorMessage: string) => {
    this.props.notify(notifySNMPConnectFailed(errorMessage))
  }

  private get deviceStatus(): JSX.Element {
    const {onDismissOverlay} = this.props
    const {deviceStatusTableData, isDeviceDataSaveButtonEnabled} = this.state
    const importFileDeviceStatusColums = IMPORT_FILE_DEVICE_STATUS_COLUMNS

    return (
      <>
        <OverlayHeading
          title={'Import Device File'}
          onDismiss={onDismissOverlay}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <>
                <TableComponent
                  columns={importFileDeviceStatusColums}
                  data={deviceStatusTableData}
                />
              </>
            </Form.Element>
            <Form.Footer>
              <Button
                text="Go Back"
                color={ComponentColor.Default}
                onClick={this.handleGoBackImportedDeviceFile}
              />
              <Button
                text="Save"
                color={ComponentColor.Success}
                onClick={this.handleSaveImportedDeviceFile}
                status={
                  isDeviceDataSaveButtonEnabled
                    ? ComponentStatus.Default
                    : ComponentStatus.Disabled
                }
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </>
    )
  }

  private handleGoBackImportedDeviceFile = () => {
    this.setState({
      deviceDataRawFromCSV: '',
      devicesDataParsedFromCSV: [],
      deviceStatusTableData: [],
      importDevicePageStatus: 'UploadCSV',
      isDeviceDataSaveButtonEnabled: false,
      devicesData: [],
    })
  }

  private handleSaveImportedDeviceFile = () => {
    this.createDevices()
  }

  private createDevices = async () => {
    const {devicesData} = this.state
    try {
      const {failed_devices} = await createDevices(devicesData)

      if (failed_devices && failed_devices.length > 0) {
        return this.handleCreateDevicesErrorWithFailedDevices(failed_devices)
      }

      return this.handleCreateDevicesSuccess()
    } catch (error) {
      return this.handleCreateDevicesError(error.message)
    }
  }

  private handleCreateDevicesError = (errorMessage: string) => {
    const {onDismissOverlay} = this.props

    this.props.notify(notifyCreateDevicesFailed(errorMessage))
    onDismissOverlay()
  }

  private handleCreateDevicesErrorWithFailedDevices = (
    failedDevices: FailedDevice[]
  ) => {
    const {onDismissOverlay} = this.props
    const failedMessage = this.getFailedDevicesString(failedDevices)

    this.props.notify(notifyCreateDevicesFailed(failedMessage))
    onDismissOverlay()
  }

  private getFailedDevicesString = (failedDevices: FailedDevice[]): string => {
    const deviceIps = failedDevices.map(device => device.device_ip).join(', ')
    return `Failed Devices: ${deviceIps}`
  }

  private handleCreateDevicesSuccess = () => {
    const {onDismissOverlay} = this.props

    this.props.notify(notifyCreateDevicesSucceeded())
    onDismissOverlay()
  }
}

export default ImportDevicePage
