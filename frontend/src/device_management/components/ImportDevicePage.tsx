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
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

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
  Organization,
} from 'src/types'

// Utils
import {downloadCSV} from 'src/shared/utils/downloadTimeseriesCSV'
import {
  convertDeviceDataOrganizationNameToID,
  parseErrorMessage,
} from 'src/device_management/utils'

// API
import {
  saveDevicesWithCSVUpload,
  validateSNMPConnection,
} from 'src/device_management/apis'

import {ErrorHandling} from 'src/shared/decorators/errors'

import {
  csvExportFailed,
  notifyCSVUploadFailed,
  notifyCSVUploadFailedWithMessage,
  notifyFetchSNMPConnectStatusSucceeded,
  notifySNMPConnectFailed,
  notifySaveDevicesFailed,
  notifySaveDevicesSucceeded,
} from 'src/shared/copy/notifications'

interface Props {
  isVisible: boolean
  organizations: Organization[]
  notify: (n: Notification) => void
  onDismissOverlay: () => void
  setDeviceManagementIsLoading: (isLoading: boolean) => void
  refreshStateForDeviceManagement: () => void
}

interface State {
  deviceDataRawFromCSV: string
  devicesDataParsedFromCSV: Array<any>
  deviceStatusTableData: DataTableObject[]
  isDeviceDataSaveButtonEnabled: boolean
  importDevicePageStatus: ImportDevicePageStatus
  devicesData: [] | DeviceData[]
  deviceStatusMessageJSXElement: JSX.Element
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
      deviceStatusMessageJSXElement: <></>,
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.isVisible !== this.props.isVisible) {
      this.initializeComponentState()
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
    const {deviceDataRawFromCSV} = this.state

    return (
      <>
        <OverlayHeading
          title={'Import Device File'}
          onDismiss={this.dismissOverlayAndinitializeComponentState}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <>
                <div className="form-group col-xs-12">
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
      <div className="device-management-import">
        <label className="device-management-import--header">
          Upload a CSV File
        </label>
        <CSVDeviceTemplateExporter
          title="CSV Template Download"
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

    this.setState({
      deviceDataRawFromCSV: uploadContent,
    })

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
        notify(notifyCSVUploadFailedWithMessage(parseErrorMessage(error)))
      },
    })
  }

  private handleGoNextImportedDeviceFile = () => {
    this.handleValidateSNMPConnection()
  }

  private handleValidateSNMPConnection = async () => {
    const {setDeviceManagementIsLoading} = this.props

    try {
      const snmpConfigs = this.generateSNMPConfigs()
      setDeviceManagementIsLoading(true)
      const {failed_requests, results} = await validateSNMPConnection(
        snmpConfigs
      )

      return this.handleSNMPConnection(failed_requests, results)
    } catch (error) {
      return this.handleSNMPConnectionError(parseErrorMessage(error))
    }
  }

  private generateSNMPConfigs = (): SNMPConnectionRequest[] => {
    const {devicesDataParsedFromCSV} = this.state

    return devicesDataParsedFromCSV.map(snmpConfig => {
      const {
        device_ip,
        snmp_community,
        snmp_port,
        snmp_version,
        snmp_protocol,
        security_name,
        auth_protocol,
        auth_pass,
        priv_protocol,
        priv_pass,
        security_level,
      } = snmpConfig

      const snmpVersionString = String(snmp_version)
      const securityLevelLower = security_level
        ? security_level.toLowerCase()
        : ''

      return {
        device_ip,
        community: snmpVersionString === '3' ? '' : snmp_community,
        port: snmp_port,
        version: snmpVersionString,
        protocol: snmp_protocol,
        security_level: snmpVersionString === '3' ? security_level : '',
        security_name: snmpVersionString === '3' ? security_name : '',
        auth_protocol:
          snmpVersionString === '3' && securityLevelLower !== 'noauthnopriv'
            ? auth_protocol
            : '',
        auth_pass:
          snmpVersionString === '3' && securityLevelLower !== 'noauthnopriv'
            ? auth_pass
            : '',
        priv_protocol:
          snmpVersionString === '3' && securityLevelLower === 'authpriv'
            ? priv_protocol
            : '',
        priv_pass:
          snmpVersionString === '3' && securityLevelLower === 'authpriv'
            ? priv_pass
            : '',
      }
    })
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

    const deviceStatusMessageJSXElement = this.generateDeviceStatusMessageJSXElement(
      failed_requests,
      snmpConnectionSuccessDevices
    )

    this.props.notify(notifyFetchSNMPConnectStatusSucceeded())
    this.props.setDeviceManagementIsLoading(false)
    this.setState({
      importDevicePageStatus: 'DeviceStatus',
      isDeviceDataSaveButtonEnabled: isDeviceDataSaveButtonEnabled,
      deviceStatusTableData: deviceStatusTableData,
      devicesData: devicesData as [] | DeviceData[],
      deviceStatusMessageJSXElement: deviceStatusMessageJSXElement,
    })
  }

  private generateDevicesData = (
    snmpConnectionSuccessDevices: null | SNMPConnectionSuccessDevice[]
  ) => {
    if (!snmpConnectionSuccessDevices) {
      return []
    }

    const {devicesDataParsedFromCSV} = this.state
    const devicesData = devicesDataParsedFromCSV
      .filter(deviceData => {
        return _.some(
          snmpConnectionSuccessDevices,
          snmpConnectionSuccessDevice =>
            snmpConnectionSuccessDevice.device_ip === deviceData.device_ip
        )
      })
      .map(deviceData => {
        const result = _.find(
          snmpConnectionSuccessDevices,
          snmpConnectionSuccessDevice =>
            snmpConnectionSuccessDevice.device_ip === deviceData.device_ip
        )

        const {
          snmp_community,
          snmp_port,
          snmp_version,
          snmp_protocol,
          security_name,
          auth_protocol,
          auth_pass,
          priv_protocol,
          priv_pass,
          security_level,
        } = deviceData

        const snmpVersionString = String(snmp_version)
        const securityLevelLower = security_level
          ? security_level.toLowerCase()
          : ''

        return {
          organization: deviceData?.organization || '',
          device_ip: deviceData?.device_ip || '',
          hostname: result?.hostname || '',
          device_type: result?.device_type || '',
          device_os: result?.device_os || '',
          ssh_config: {
            user_id: deviceData?.ssh_user_id || '',
            password: deviceData?.ssh_password || '',
            en_password: deviceData?.ssh_en_password || '',
            port: deviceData?.ssh_port || 22,
          },
          snmp_config: {
            community: snmpVersionString === '3' ? '' : snmp_community,
            port: snmp_port,
            version: snmpVersionString,
            protocol: snmp_protocol,
            security_level: snmpVersionString === '3' ? security_level : '',
            security_name: snmpVersionString === '3' ? security_name : '',
            auth_protocol:
              snmpVersionString === '3' && securityLevelLower !== 'noauthnopriv'
                ? auth_protocol
                : '',
            auth_pass:
              snmpVersionString === '3' && securityLevelLower !== 'noauthnopriv'
                ? auth_pass
                : '',
            priv_protocol:
              snmpVersionString === '3' && securityLevelLower === 'authpriv'
                ? priv_protocol
                : '',
            priv_pass:
              snmpVersionString === '3' && securityLevelLower === 'authpriv'
                ? priv_pass
                : '',
          },
        }
      })

    return devicesData
  }

  private convertSNMPResponseToTableData = (
    failedDevices: SNMPConnectionFailedDevice[],
    snmpConnectionSuccessDevices: SNMPConnectionSuccessDevice[]
  ): DataTableObject[] => {
    const _failedDevices =
      _.map(
        failedDevices,
        (failedDevice: SNMPConnectionFailedDevice): DataTableObject => ({
          index: failedDevice.index,
          ip: failedDevice.device_ip,
          status: 'Failed',
          message: failedDevice.errorMessage,
        })
      ) || []

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

  private generateDeviceStatusMessageJSXElement = (
    failedDevices: SNMPConnectionFailedDevice[],
    snmpConnectionSuccessDevices: SNMPConnectionSuccessDevice[]
  ): JSX.Element => {
    if (
      failedDevices &&
      failedDevices.length === 0 &&
      snmpConnectionSuccessDevices === null
    ) {
      return (
        <>
          There is <label className="label-warning">0 device </label>to
          register.
        </>
      )
    } else if (
      snmpConnectionSuccessDevices === null &&
      failedDevices &&
      failedDevices.length > 0
    ) {
      return (
        <>
          <label className="label-warning">No device </label> succeeded in SNMP
          Connection
        </>
      )
    } else if (
      snmpConnectionSuccessDevices.length > 0 &&
      failedDevices &&
      failedDevices.length === 0
    ) {
      return (
        <>
          Devices will be registered if you click the
          <label className="label-info--save"> Save button.</label>
        </>
      )
    } else if (
      snmpConnectionSuccessDevices.length > 0 &&
      failedDevices &&
      failedDevices.length > 0
    ) {
      return (
        <>
          <label className="label-warning">
            Only devices that succeeded in SNMP Connection{' '}
          </label>
          will be registered if you click the
          <label className="label-info--save"> Save button.</label>
        </>
      )
    }
    return <></>
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
    this.props.setDeviceManagementIsLoading(false)
  }

  private finalizeAPIResponse = () => {
    const {
      refreshStateForDeviceManagement,
      setDeviceManagementIsLoading,
    } = this.props

    setDeviceManagementIsLoading(false)
    refreshStateForDeviceManagement()
  }

  private scrollMaxHeight = window.innerHeight * 0.45

  private get deviceStatus(): JSX.Element {
    const {
      deviceStatusTableData,
      isDeviceDataSaveButtonEnabled,
      deviceStatusMessageJSXElement,
    } = this.state
    const importFileDeviceStatusColums = IMPORT_FILE_DEVICE_STATUS_COLUMNS

    return (
      <>
        <OverlayHeading
          title={'Import Device File'}
          onDismiss={this.dismissOverlayAndinitializeComponentState}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <>
                <label className="device-status--header">
                  SNMP Connection Result
                </label>
                <FancyScrollbar
                  autoHeight={true}
                  maxHeight={this.scrollMaxHeight}
                  children={
                    <TableComponent
                      columns={importFileDeviceStatusColums}
                      data={deviceStatusTableData}
                      initSort={{
                        key: 'index',
                        isDesc: false,
                      }}
                    />
                  }
                ></FancyScrollbar>
              </>
            </Form.Element>
            <Form.Element>
              <div
                className="device-management-message"
                style={{paddingTop: '5px'}}
              >
                <label>{deviceStatusMessageJSXElement}</label>
              </div>
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

  private dismissOverlayAndinitializeComponentState = () => {
    const {onDismissOverlay} = this.props

    this.initializeComponentState()
    onDismissOverlay()
  }

  private initializeComponentState() {
    this.setState({
      deviceDataRawFromCSV: '',
      devicesDataParsedFromCSV: [],
      deviceStatusTableData: [],
      importDevicePageStatus: 'UploadCSV',
      isDeviceDataSaveButtonEnabled: false,
      devicesData: [],
      deviceStatusMessageJSXElement: <></>,
    })
  }

  private handleGoBackImportedDeviceFile = () => {
    this.initializeComponentState()
  }

  private handleSaveImportedDeviceFile = () => {
    this.saveDevices()
  }

  private saveDevices = async () => {
    const {organizations} = this.props
    const {devicesData} = this.state

    try {
      const convertedDeviceData = convertDeviceDataOrganizationNameToID(
        devicesData,
        organizations
      ) as DeviceData[]

      this.props.setDeviceManagementIsLoading(true)
      const {failed_devices} = await saveDevicesWithCSVUpload(
        convertedDeviceData
      )

      if (failed_devices && failed_devices.length > 0) {
        return this.handleSaveDevicesErrorWithFailedDevices(failed_devices)
      }

      return this.handleSaveDevicesSuccess()
    } catch (error) {
      return this.handleSaveDevicesError(parseErrorMessage(error))
    }
  }

  private handleSaveDevicesError = (errorMessage: string) => {
    const {onDismissOverlay} = this.props

    this.props.notify(notifySaveDevicesFailed(errorMessage))
    this.finalizeAPIResponse()
    this.initializeComponentState()
    onDismissOverlay()
  }

  private handleSaveDevicesErrorWithFailedDevices = (
    failedDevices: FailedDevice[]
  ) => {
    const {onDismissOverlay} = this.props
    const failedMessage = this.getFailedDevicesErrorMessage(failedDevices)

    this.props.notify(notifySaveDevicesFailed(failedMessage))
    this.finalizeAPIResponse()
    this.initializeComponentState()
    onDismissOverlay()
  }

  private getFailedDevicesErrorMessage = (
    failedDevices: FailedDevice[]
  ): string => {
    const limit = 5
    let messages = ''

    if (failedDevices) {
      messages = failedDevices
        .slice(0, limit)
        .map(device => `${device.device_ip}: ${device.errorMessage}`)
        .join('; ')
    }

    if (failedDevices && failedDevices.length > limit) {
      messages += `;  Total ${failedDevices.length} devices failed.`
    }

    return `${messages}`
  }

  private handleSaveDevicesSuccess = () => {
    const {onDismissOverlay} = this.props

    this.props.notify(notifySaveDevicesSucceeded())
    this.finalizeAPIResponse()
    this.initializeComponentState()
    onDismissOverlay()
  }
}

export default ImportDevicePage
