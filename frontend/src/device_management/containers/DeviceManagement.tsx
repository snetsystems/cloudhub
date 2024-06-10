// Library
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import Papa from 'papaparse'

// Components
import ImportDevicePage from 'src/device_management/components/ImportDevicePage'
import TableComponent from 'src/device_management/components/TableComponent'
import LoadingSpinner from 'src/reusable_ui/components/spinners/LoadingSpinner'
import DeviceConnection from 'src/device_management/components/DeviceConnection'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Constants
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {
  DEFAULT_DEVICE_DATA,
  DEFAULT_DEVICE_INFO,
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
  DataTableOptions,
  DevicesInfo,
  DeviceConnectionStatus,
} from 'src/types'

// Util
import {downloadCSV} from 'src/shared/utils/downloadTimeseriesCSV'

// API
import {deleteDevice, getDeviceList} from 'src/device_management/apis'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {
  csvExportFailed,
  notifyCSVUploadFailed,
  notifyCSVUploadFailedWithMessage,
} from 'src/shared/copy/notifications'

interface Props {
  isUsingAuth: boolean
  me: Me
  organizations: Organization[]
  notify: (n: Notification) => void
}

interface State {
  isLiading: boolean
  data: DevicesInfo[]
  deviceConnectionVisibility: boolean
  deviceConnectionStatus: DeviceConnectionStatus
  importDeviceWizardVisibility: boolean
  deviceData: DeviceData[]
  selectedDeviceData: DevicesInfo
  deviceDataRawFromCSV: string
  deviceDataParsedFromCSV: Array<any>
  importDevicePageStatus: ImportDevicePageStatus
  checkedArray: string[]
}

const VERSION = process.env.npm_package_version

@ErrorHandling
class DeviceManagement extends PureComponent<Props, State> {
  private isComponentMounted: boolean = true

  constructor(props: Props) {
    super(props)
    this.state = {
      data: [],
      isLiading: false,
      deviceConnectionVisibility: false,
      deviceConnectionStatus: 'None',
      importDeviceWizardVisibility: false,
      deviceData: [DEFAULT_DEVICE_DATA as DeviceData],
      selectedDeviceData: DEFAULT_DEVICE_INFO,
      deviceDataRawFromCSV: '',
      deviceDataParsedFromCSV: [],
      importDevicePageStatus: 'UploadCSV',
      checkedArray: [],
    }

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    this.connectDevice = this.connectDevice.bind(this)
    this.handleRowClick = this.handleRowClick.bind(this)
  }

  public componentDidMount(): void {
    try {
      this.getDeviceAJAX()
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  public componentWillUnmount() {
    this.isComponentMounted = false
  }

  public render() {
    const {me, organizations, isUsingAuth} = this.props
    const {
      deviceConnectionVisibility,
      deviceConnectionStatus,
      deviceDataRawFromCSV,
      importDevicePageStatus,
      importDeviceWizardVisibility,
      selectedDeviceData,
    } = this.state

    return (
      <>
        <TableComponent
          tableTitle={`${
            this.state.data.length
              ? this.state.data.length === 1
                ? '1 Device'
                : this.state.data.length + ' ' + 'Devices'
              : '0 Device'
          } list`}
          data={this.state.data}
          columns={this.column}
          checkedArray={this.state.checkedArray}
          setCheckedArray={(value: string[]) =>
            this.setState({checkedArray: value})
          }
          options={this.options}
          topLeftRender={
            <div className="device-management-top left">
              <div className="space-x">
                <Authorized requiredRole={EDITOR_ROLE}>
                  <button
                    onClick={() => {
                      this.setState({isLiading: true})
                      this.deleteDevicesAJAX(this.state.checkedArray)
                    }}
                    className="btn button btn-sm btn-primary"
                    disabled={this.state.checkedArray.length === 0}
                  >
                    <span className="icon trash" /> Delete Device
                  </button>
                </Authorized>
                {/* TODO Consder requiredRole */}
                <Authorized requiredRole={EDITOR_ROLE}>
                  <button
                    onClick={() => {
                      console.log('checked array: ', this.state.checkedArray)
                    }}
                    className="btn button btn-sm btn-primary"
                    // disabled={this.state.checkedArray.length === 0}
                  >
                    <span className="icon import" /> Apply Monitoring
                  </button>
                </Authorized>
              </div>
              <div className="space-x">
                <Authorized requiredRole={EDITOR_ROLE}>
                  <div
                    onClick={this.connectDevice('Creating')}
                    className="btn button btn-sm btn-primary"
                  >
                    <span className="icon plus" /> Add Device
                  </div>
                </Authorized>
                {/* TODO Consder requiredRole */}
                <Authorized requiredRole={EDITOR_ROLE}>
                  <div
                    onClick={this.importDevice}
                    className="btn button btn-sm btn-primary"
                  >
                    <span className="icon import" /> Import Device
                  </div>
                </Authorized>
              </div>
            </div>
          }
        />

        <DeviceConnection
          deviceConnectionStatus={deviceConnectionStatus}
          isVisible={deviceConnectionVisibility}
          notify={this.props.notify}
          me={me}
          organizations={organizations}
          selectedDeviceData={selectedDeviceData}
          isUsingAuth={isUsingAuth}
          toggleVisibility={this.handleToggleDeviceConnectionModal}
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

        {this.state.isLiading && (
          <div className="loading-box">
            <LoadingSpinner />
          </div>
        )}
      </>
    )
  }

  private column = columns

  private getDeviceAJAX = async () => {
    const {data} = await getDeviceList()
    this.setState({data: data.Devices})
  }

  private handleRowClick = selectedDeviceData => {
    this.connectDevice('Updating')()
    this.setState({selectedDeviceData: selectedDeviceData})
  }

  private options: DataTableOptions = {
    tbodyRow: {
      onClick: this.handleRowClick,
    },
  }

  private deleteDevicesAJAX = async (idList: string[]) => {
    await deleteDevice({devices_id: idList})
    this.getDeviceAJAX()
    this.setState({checkedArray: [], isLiading: false})
  }

  private connectDevice = (
    deviceConnectionStatus?: DeviceConnectionStatus
  ) => () => {
    this.setState({
      deviceConnectionVisibility: true,
      deviceConnectionStatus: deviceConnectionStatus,
    })
  }

  private handleToggleDeviceConnectionModal = deviceConnectionVisibility => () => {
    this.setState({
      deviceConnectionVisibility: deviceConnectionVisibility,
      deviceConnectionStatus: deviceConnectionVisibility
        ? this.state.deviceConnectionStatus
        : 'None',
    })
  }

  private importDevice = () => {
    this.setState({
      importDeviceWizardVisibility: true,
    })
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
