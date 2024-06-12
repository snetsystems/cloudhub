// Library
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

// Components
import ImportDevicePage from 'src/device_management/components/ImportDevicePage'
import TableComponent from 'src/device_management/components/TableComponent'
import LoadingSpinner from 'src/reusable_ui/components/spinners/LoadingSpinner'
import DeviceConnection from 'src/device_management/components/DeviceConnection'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {openShell} from 'src/shared/actions/shell'

// Constants
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {
  DEFAULT_NETWORK_DEVICE_DATA,
  columns,
} from 'src/device_management/constants'

// Type
import {
  Me,
  Notification,
  Organization,
  DeviceData,
  DeviceConnectionStatus,
  ShellInfo,
} from 'src/types'

// API
import {deleteDevice, getDeviceList} from 'src/device_management/apis'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  isUsingAuth: boolean
  me: Me
  organizations: Organization[]
  notify: (n: Notification) => void
  openShell: (shell: ShellInfo) => void
}

interface State {
  isLoading: boolean
  data: DeviceData[]
  deviceConnectionVisibility: boolean
  deviceConnectionStatus: DeviceConnectionStatus
  importDeviceWizardVisibility: boolean
  deviceData: DeviceData[]
  selectedDeviceData: DeviceData
  checkedArray: string[]
}

@ErrorHandling
class DeviceManagement extends PureComponent<Props, State> {
  private isComponentMounted: boolean = true

  constructor(props: Props) {
    super(props)
    this.state = {
      data: [],
      isLoading: false,
      deviceConnectionVisibility: false,
      deviceConnectionStatus: 'None',
      importDeviceWizardVisibility: false,
      deviceData: [DEFAULT_NETWORK_DEVICE_DATA as DeviceData],
      selectedDeviceData: DEFAULT_NETWORK_DEVICE_DATA,
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
          // options={this.options}
          topLeftRender={
            <div className="device-management-top left">
              <div className="space-x">
                <Authorized requiredRole={EDITOR_ROLE}>
                  <button
                    onClick={() => {
                      this.setState({isLoading: true})
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
                    className="btn button btn-sm btn-primary"
                    // disabled={this.state.checkedArray.length === 0}
                  >
                    <span className="icon import" /> Apply Monitoring
                  </button>
                </Authorized>
              </div>
              <div className="space-x">
                <Authorized requiredRole={EDITOR_ROLE}>
                  <div className="btn button btn-sm btn-primary">
                    <span className="icon computer-desktop" /> Learning Setting
                  </div>
                </Authorized>

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
          isVisible={importDeviceWizardVisibility}
          onDismissOverlay={this.handleDismissImportDeviceModalOverlay}
          notify={this.props.notify}
        />

        {this.state.isLoading && (
          <div className="loading-box">
            <LoadingSpinner />
          </div>
        )}
      </>
    )
  }

  private getDeviceAJAX = async () => {
    const {data} = await getDeviceList()
    this.setState({data: data.Devices})
  }

  private onClickShellModalOpen = (shell: ShellInfo) => {
    this.props.openShell(shell)
  }

  private handleRowClick = selectedDeviceData => {
    this.connectDevice('Updating')()
    this.setState({selectedDeviceData: selectedDeviceData})
  }

  private column = columns({
    onEditClick: this.handleRowClick,
    onConsoleClick: this.onClickShellModalOpen,
  })

  // private options: DataTableOptions = {
  //   tbodyRow: {
  //     onClick: this.handleRowClick,
  //   },
  // }

  private deleteDevicesAJAX = async (idList: string[]) => {
    await deleteDevice({devices_id: idList})
    this.getDeviceAJAX()
    this.setState({checkedArray: [], isLoading: false})
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
    this.getDeviceAJAX()
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
    this.getDeviceAJAX()
    this.setState({
      importDeviceWizardVisibility: false,
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
  openShell: bindActionCreators(openShell, dispatch),
})

export default connect(mstp, mdtp, null)(DeviceManagement)
