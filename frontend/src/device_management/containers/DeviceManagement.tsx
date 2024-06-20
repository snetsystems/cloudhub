// Library
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'

// Components
import ImportDevicePage from 'src/device_management/components/ImportDevicePage'
import TableComponent from 'src/device_management/components/TableComponent'
import LoadingSpinner from 'src/reusable_ui/components/spinners/LoadingSpinner'
import DeviceConnection from 'src/device_management/components/DeviceConnection'

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
} from 'src/types'

// API
import {
  deleteDevice,
  fetchDeviceMonitoringStatus,
  getDeviceList,
} from 'src/device_management/apis'
import {getEnv} from 'src/shared/apis/env'

// Utils
import {convertDeviceDataOrganizationIDToName} from 'src/device_management/utils'
import {getDeep} from 'src/utils/wrappers'
import {generateForHosts} from 'src/utils/tempVars'

import {ErrorHandling} from 'src/shared/decorators/errors'

import {closeModal, openModal} from 'src/shared/actions/aiModal'
import {notifyFetchDeviceMonitoringStatusFailed} from 'src/shared/copy/notifications'
import DeviceManagementBtn from '../components/DeviceManagementBtn'

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
              data={data}
              getDeviceAJAX={this.getDeviceAJAX}
              importDevice={this.importDevice}
              connectDevice={this.connectDevice}
              checkedArray={checkedArray}
              deleteDevicesAJAX={this.deleteDevicesAJAX}
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
        {/* table + toggle btn UI */}
        {/* {monitoringModalVisibility && (
      <ApplyMonitoringModal
        isVisible={monitoringModalVisibility}
        setIsVisible={this.onClickMonitoringClose}
        applyLearningData={selectedArrayById(data, checkedArray, 'id')}
      />
    )} */}

        {this.state.isLoading && (
          <div className="loading-box">
            <LoadingSpinner />
          </div>
        )}
      </>
    )
  }

  private getDeviceAJAX = async () => {
    const {organizations} = this.props
    const {data} = await getDeviceList()
    const convertedDeviceData = convertDeviceDataOrganizationIDToName(
      data.Devices,
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
    await deleteDevice({devices_id: numIdList})

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
