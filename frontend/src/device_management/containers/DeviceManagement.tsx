// Library
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Components
import ImportDevicePage from 'src/device_management/components/ImportDevicePage'
import TableComponent from 'src/device_management/components/TableComponent'
import DeviceConnection from 'src/device_management/components/DeviceConnection'
import PageSpinner from 'src/shared/components/PageSpinner'
import DeviceManagementBtn from 'src/device_management/components/DeviceManagementBtn'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {openShell} from 'src/shared/actions/shell'

// Constants
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
  AiModal,
  Source,
  Links,
  DeviceMonitoringStatus,
  FailedDevice,
  CollectingDevice,
  ApplyMonitoringRequest,
} from 'src/types'

// API
import {
  applyMonitoring,
  deleteDevice,
  fetchDeviceMonitoringStatus,
  getDeviceList,
} from 'src/device_management/apis'
import {getEnv} from 'src/shared/apis/env'

// Utils
import {
  convertDeviceDataOrganizationIDToName,
  selectedArrayById,
} from 'src/device_management/utils'
import {getDeep} from 'src/utils/wrappers'
import {generateForHosts} from 'src/utils/tempVars'

import {ErrorHandling} from 'src/shared/decorators/errors'

import {closeModal, openModal} from 'src/shared/actions/aiModal'
import {
  notifyApplyMonitoringFailed,
  notifyApplyMonitoringSuccess,
  notifyDeleteDevicesFailed,
  notifyDeleteDevicesSucceeded,
  notifyFetchDeviceMonitoringStatusFailed,
} from 'src/shared/copy/notifications'

interface Auth {
  me: Me
}

interface Props {
  auth: Auth
  source: Source
  links: Links
  isUsingAuth: boolean
  me: Me
  organizations: Organization[]
  notify: (n: Notification) => void
  openShell: (shell: ShellInfo) => void
  openModal: (aiModal: AiModal) => void
  closeModal: () => void
}

interface State {
  isLoading: boolean
  data: DeviceData[]
  deviceConnectionVisibility: boolean
  deviceConnectionStatus: DeviceConnectionStatus
  deviceMonitoringStatus: DeviceMonitoringStatus
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
      deviceMonitoringStatus: {},
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
      this.fetchDeviceMonitoringStatus()
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
      data,
      deviceMonitoringStatus,
      deviceConnectionVisibility,
      deviceConnectionStatus,
      importDeviceWizardVisibility,
      selectedDeviceData,
      checkedArray,
    } = this.state
    const updatedDeviceData = this.getDeviceMonitoringStatus(
      data,
      deviceMonitoringStatus
    )

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
          data={updatedDeviceData}
          columns={this.column}
          checkedArray={this.state.checkedArray}
          setCheckedArray={(value: string[]) =>
            this.setState({checkedArray: value})
          }
          // options={this.options}
          topLeftRender={
            <DeviceManagementBtn
              data={updatedDeviceData}
              getDeviceAJAX={this.getDeviceAJAX}
              importDevice={this.importDevice}
              connectDevice={this.connectDevice}
              checkedArray={checkedArray}
              deleteDevicesAJAX={this.deleteDevicesAJAX}
              applyMonitoringAJAX={this.applyMonitoringAJAX}
            />
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
          setDeviceManagementIsLoading={this.setDeviceManagementIsLoading}
        />
        <ImportDevicePage
          isVisible={importDeviceWizardVisibility}
          organizations={organizations}
          onDismissOverlay={this.handleDismissImportDeviceModalOverlay}
          notify={this.props.notify}
          setDeviceManagementIsLoading={this.setDeviceManagementIsLoading}
        />
        {this.state.isLoading && this.LoadingState}
        {/* table + toggle btn UI */}
        {/* {monitoringModalVisibility && (
      <ApplyMonitoringModal
        isVisible={monitoringModalVisibility}
        setIsVisible={this.onClickMonitoringClose}
        applyLearningData={selectedArrayById(data, checkedArray, 'id')}
      />
    )} */}
      </>
    )
  }

  private get LoadingState(): JSX.Element {
    const {isLoading} = this.state
    const pageSpinnerHeight = isLoading ? '50%' : '100%'

    return (
      <div className="device-management--loading">
        <PageSpinner pageSpinnerHeight={pageSpinnerHeight} />
      </div>
    )
  }

  private getDeviceAJAX = async () => {
    const {organizations} = this.props
    const {data} = await getDeviceList()
    const convertedDeviceData = convertDeviceDataOrganizationIDToName(
      data.devices,
      organizations
    ) as DeviceData[]

    this.setState({data: convertedDeviceData})
  }

  private fetchDeviceMonitoringStatus = async () => {
    try {
      const {source, links} = this.props
      const envVars = await getEnv(links.environment)
      const telegrafSystemInterval = getDeep<string>(
        envVars,
        'telegrafSystemInterval',
        ''
      )
      const tempVars = generateForHosts(source)
      const deviceMonitoringStatus = await fetchDeviceMonitoringStatus(
        source.links.proxy,
        source.telegraf,
        telegrafSystemInterval,
        tempVars
      )

      this.setState({
        deviceMonitoringStatus,
      })
    } catch (error) {
      this.props.notify(
        notifyFetchDeviceMonitoringStatusFailed(error.message || '')
      )
    }
  }

  private getDeviceMonitoringStatus(
    devicesData: DeviceData[],
    deviceMonitoringStatus: DeviceMonitoringStatus
  ) {
    return devicesData.map(device => {
      const {device_ip} = device
      const uptime = deviceMonitoringStatus?.[device_ip]?.uptime || 0
      const isMonitoring = uptime !== 0
      return {
        ...device,
        isMonitoring,
      }
    })
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

  private deleteDevicesAJAX = async (idList: string[]) => {
    const numIdList = idList.map(i => Number(i))
    this.setState({isLoading: true})

    try {
      await deleteDevice({devices_ids: numIdList})

      this.props.notify(notifyDeleteDevicesSucceeded())
      this.getDeviceAJAX()
      this.setState({checkedArray: [], isLoading: false})
    } catch (error) {
      this.props.notify(notifyDeleteDevicesFailed(error.message || ''))
      this.getDeviceAJAX()
      this.setState({checkedArray: [], isLoading: false})
    }
  }

  private applyMonitoringAJAX = async () => {
    const {data, checkedArray} = this.state

    const selectedDeviceData = selectedArrayById(data, checkedArray, 'id')
    const applyMonitoringRequest = this.convertDeviceDataToApplyMonitoringRequest(
      selectedDeviceData
    )

    this.setState({isLoading: true})

    try {
      const {failed_devices} = await applyMonitoring(applyMonitoringRequest)

      if (failed_devices && failed_devices.length > 0) {
        return this.handleApplyMonitoringErrorWithFailedDevices(failed_devices)
      }

      return this.handleApplyMonitoringSuccess()
    } catch (error) {
      return this.handleApplyMonitoringError(error.message || '')
    }
  }

  private convertDeviceDataToApplyMonitoringRequest = (
    devicesData: DeviceData[]
  ): ApplyMonitoringRequest => {
    const collecting_devices: CollectingDevice[] = devicesData.map(device => ({
      device_id: device.id || 0, // id가 없으면 기본값 0 사용
      is_learning: device.is_learning || false,
      is_collecting_cfg_written: device.is_collecting_cfg_written || false,
    }))

    return {collecting_devices}
  }

  private handleApplyMonitoringError = (errorMessage: string) => {
    this.getDeviceAJAX()
    this.setState({checkedArray: [], isLoading: false})
    this.props.notify(notifyApplyMonitoringFailed(errorMessage))
  }

  private handleApplyMonitoringErrorWithFailedDevices = (
    failedDevices: FailedDevice[]
  ) => {
    const failedMessage = this.getFailedDevicesErrorMessage(failedDevices)

    this.getDeviceAJAX()
    this.setState({checkedArray: [], isLoading: false})
    this.props.notify(notifyApplyMonitoringFailed(failedMessage))
  }

  private getFailedDevicesErrorMessage = (
    failedDevices: FailedDevice[]
  ): string => {
    const data = this.state.data

    const limit = 5
    let messages = failedDevices
      .slice(0, limit)
      .map(device => {
        const deviceID = [device?.device_id]
        const failedDevice = selectedArrayById(data, deviceID, 'id')
        const deviceIp = failedDevice?.[0]?.device_ip ?? 'Unknown Device'

        return `${deviceIp}: ${device.errorMessage}`
      })
      .join('.')

    if (failedDevices.length > limit) {
      messages += `Total ${failedDevices.length} devices failed`
    }

    return `${messages}`
  }

  private handleApplyMonitoringSuccess = () => {
    this.getDeviceAJAX()
    this.setState({checkedArray: [], isLoading: false})
    this.props.notify(notifyApplyMonitoringSuccess())
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

  private setDeviceManagementIsLoading = (isLoading: boolean) => {
    this.setState({isLoading})
  }
}

const mstp = ({adminCloudHub: {organizations}, auth, links}) => ({
  organizations,
  isUsingAuth: auth.isUsingAuth,
  auth,
  me: auth.me,
  links,
})

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
  openShell: bindActionCreators(openShell, dispatch),
  openModal: bindActionCreators(openModal, dispatch),
  closeModal: bindActionCreators(closeModal, dispatch),
})

export default connect(mstp, mdtp, null)(DeviceManagement)
