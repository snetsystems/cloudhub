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
import LearningSettingModal from 'src/device_management/components/LearningSettingModal'
import ApplyMonitoringModal from 'src/device_management/components/ApplyMonitoringModal'
import ApplyLearningModal from 'src/device_management/components/ApplyLearningModal'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {openShell} from 'src/shared/actions/shell'
import {closeModal, openModal} from 'src/shared/actions/aiModal'

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
  DevicesOrgData,
  Kapacitor,
  FailedDevice,
  DeviceOrganizationStatus,
  TimeZones,
} from 'src/types'

// API
import {
  deleteDevice,
  fetchDeviceMonitoringStatus,
  getAllDevicesOrg,
  getDeviceList,
} from 'src/device_management/apis'
import {getEnv} from 'src/shared/apis/env'

// Utils
import {
  convertDeviceDataOrganizationIDToName,
  getNetworkDeviceOrganizationStatus,
  parseErrorMessage,
  selectedArrayById,
} from 'src/device_management/utils'
import {getDeep} from 'src/utils/wrappers'
import {generateForHosts} from 'src/utils/tempVars'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

import {ErrorHandling} from 'src/shared/decorators/errors'

import {
  notifyDeleteDevicesFailed,
  notifyDeleteDevicesSucceeded,
  notifyFetchDeviceListError,
  notifyFetchDeviceMonitoringStatusFailed,
  notifyKapacitorConnectionFailed,
} from 'src/shared/copy/notifications'
import {getKapacitors} from 'src/shared/apis'

interface Auth {
  me: Me
}

interface ManualRefresh {
  key: string
  value: number
}

interface Props {
  auth: Auth
  source: Source
  sources: Source[]
  links: Links
  isUsingAuth: boolean
  me: Me
  organizations: Organization[]
  timeZone: TimeZones
  notify: (n: Notification) => void
  openShell: (shell: ShellInfo) => void
  openModal: (aiModal: AiModal) => void
  closeModal: () => void
  autoRefresh: number
  manualRefresh: ManualRefresh
}

interface State {
  isLoading: boolean
  data: DeviceData[]
  deviceConnectionVisibility: boolean
  deviceConnectionStatus: DeviceConnectionStatus
  deviceMonitoringStatus: DeviceMonitoringStatus
  importDeviceWizardVisibility: boolean
  isLearningSettingModalVisibility: boolean
  deviceData: DeviceData[]
  selectedDeviceData: DeviceData
  checkedArray: string[]
  orgLearningModel: DevicesOrgData[]
  networkDeviceOrganizationStatus: DeviceOrganizationStatus
  applyMonitoringModalVisibility: boolean
  learningModelModalVisibility: boolean
  kapacitors: Kapacitor[]
}

@ErrorHandling
class DeviceManagement extends PureComponent<Props, State> {
  private isComponentMounted: boolean = true

  constructor(props: Props) {
    super(props)
    this.state = {
      data: [],
      deviceMonitoringStatus: {},
      deviceData: [DEFAULT_NETWORK_DEVICE_DATA as DeviceData],
      selectedDeviceData: DEFAULT_NETWORK_DEVICE_DATA,
      checkedArray: [],
      orgLearningModel: [],
      networkDeviceOrganizationStatus: {},
      kapacitors: [],
      isLoading: false,
      deviceConnectionStatus: 'None',
      deviceConnectionVisibility: false,
      importDeviceWizardVisibility: false,
      isLearningSettingModalVisibility: false,
      applyMonitoringModalVisibility: false,
      learningModelModalVisibility: false,
    }

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    this.connectDevice = this.connectDevice.bind(this)
    this.handleRowClick = this.handleRowClick.bind(this)
  }

  public intervalID: number

  public async componentDidMount() {
    const {autoRefresh, source} = this.props

    try {
      await this.getDeviceAJAX()
      await this.getNetworkDeviceOrganizationsAJAX()
      this.fetchDeviceMonitoringStatus()
      this.getKapacitorsFromSelectedSource(source)

      if (autoRefresh) {
        this.intervalID = window.setInterval(
          () => this.refreshStateForDeviceManagement(),
          autoRefresh
        )
      }

      GlobalAutoRefresher.poll(autoRefresh)
    } catch (error) {
      console.error(parseErrorMessage(error))
    }
  }

  public async componentDidUpdate(prevProps: Props) {
    const {autoRefresh, manualRefresh} = this.props

    if (!_.isEqual(prevProps.manualRefresh, manualRefresh)) {
      this.refreshStateForDeviceManagement()
    }

    if (prevProps.autoRefresh !== autoRefresh) {
      clearInterval(this.intervalID)
      GlobalAutoRefresher.poll(autoRefresh)

      if (autoRefresh) {
        this.intervalID = window.setInterval(() => {
          this.refreshStateForDeviceManagement()
        }, autoRefresh)
      }
    }
  }

  private refreshStateForDeviceManagement = async () => {
    await this.getDeviceAJAX()
    this.fetchDeviceMonitoringStatus()
    this.getNetworkDeviceOrganizationsAJAX()
  }

  public componentWillUnmount() {
    this.isComponentMounted = false

    if (this.intervalID !== null) {
      clearInterval(this.intervalID)
      this.intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }

  public render() {
    const {me, organizations, isUsingAuth, source, sources} = this.props
    const {
      data,
      deviceConnectionVisibility,
      deviceConnectionStatus,
      importDeviceWizardVisibility,
      selectedDeviceData,
      checkedArray,
      networkDeviceOrganizationStatus,
      isLearningSettingModalVisibility,
      orgLearningModel,
      applyMonitoringModalVisibility,
      learningModelModalVisibility,
    } = this.state

    return (
      <>
        <div className="device-management--wrapper">
          <TableComponent
            timeZone={this.props.timeZone}
            tableTitle={`${
              this.state.data.length
                ? this.state.data.length === 1
                  ? '1 Device'
                  : this.state.data.length + ' ' + 'Devices'
                : '0 Device'
            } list`}
            data={data}
            columns={this.column}
            checkedArray={this.state.checkedArray}
            setCheckedArray={(value: string[]) =>
              this.setState({checkedArray: value})
            }
            // options={this.options}
            topLeftRender={
              <DeviceManagementBtn
                data={data}
                importDevice={this.importDevice}
                connectDevice={this.connectDevice}
                reLearnSetting={this.reLearnSetting}
                checkedArray={checkedArray}
                networkDeviceOrganizationStatus={
                  networkDeviceOrganizationStatus
                }
                deleteDevicesAJAX={this.deleteDevicesAJAX}
                onOpenApplyMonitoringModal={this.handleOpenApplyMonitoringModal}
                onOpenLearningModelModal={this.handleOpenLearningModelModal}
              />
            }
          />
        </div>
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
          refreshStateForDeviceManagement={this.refreshStateForDeviceManagement}
        />
        <ImportDevicePage
          isVisible={importDeviceWizardVisibility}
          organizations={organizations}
          onDismissOverlay={this.handleDismissImportDeviceModalOverlay}
          notify={this.props.notify}
          setDeviceManagementIsLoading={this.setDeviceManagementIsLoading}
          refreshStateForDeviceManagement={this.refreshStateForDeviceManagement}
        />
        <LearningSettingModal
          isVisible={isLearningSettingModalVisibility}
          orgLearningModel={orgLearningModel}
          notify={this.props.notify}
          onClose={this.onCloseLearningSettingModal}
          source={source}
          sources={sources}
          kapacitors={this.state.kapacitors}
          getKapacitorsFromSelectedSource={this.getKapacitorsFromSelectedSource}
          setDeviceManagementIsLoading={this.setDeviceManagementIsLoading}
          refreshStateForDeviceManagement={this.refreshStateForDeviceManagement}
        />
        <ApplyMonitoringModal
          isVisible={applyMonitoringModalVisibility}
          onDismissOverlay={this.handleDismissApplyMonitoringModal}
          deviceData={selectedArrayById(data, checkedArray, 'id')}
          notify={this.props.notify}
          refreshStateForDeviceManagement={this.refreshStateForDeviceManagement}
          setDeviceManagementIsLoading={this.setDeviceManagementIsLoading}
          initializeCheckedArray={this.initializeCheckedArray}
        />
        <ApplyLearningModal
          isVisible={learningModelModalVisibility}
          onDismissOverlay={this.handleDismissLearningModelModal}
          deviceData={selectedArrayById(data, checkedArray, 'id')}
          notify={this.props.notify}
          refreshStateForDeviceManagement={this.refreshStateForDeviceManagement}
          setDeviceManagementIsLoading={this.setDeviceManagementIsLoading}
          initializeCheckedArray={this.initializeCheckedArray}
        />
        {this.state.isLoading && this.LoadingState}
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

    try {
      const {data} = await getDeviceList()
      const deviceDataWithOrgNames = convertDeviceDataOrganizationIDToName(
        data?.devices || [],
        organizations
      ) as DeviceData[]

      this.setState({data: deviceDataWithOrgNames})
    } catch (error) {
      console.error(notifyFetchDeviceListError(parseErrorMessage(error)))
    }
  }

  private fetchDeviceMonitoringStatus = async () => {
    const {data} = this.state

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
      const deviceDataWithMonitoring = this.getDeviceMonitoringStatus(
        data,
        deviceMonitoringStatus
      )

      this.setState({
        deviceMonitoringStatus,
        data: deviceDataWithMonitoring,
      })
    } catch (error) {
      this.props.notify(
        notifyFetchDeviceMonitoringStatusFailed(parseErrorMessage(error))
      )
    }
  }

  private onCloseLearningSettingModal = () => {
    this.setState({isLearningSettingModalVisibility: false})
  }

  private handleOpenApplyMonitoringModal = () => {
    this.setState({applyMonitoringModalVisibility: true})
  }

  private handleDismissApplyMonitoringModal = () => {
    this.setState({applyMonitoringModalVisibility: false})
  }

  private handleOpenLearningModelModal = () => {
    this.setState({learningModelModalVisibility: true})
  }

  private handleDismissLearningModelModal = () => {
    this.setState({learningModelModalVisibility: false})
  }

  private getDeviceMonitoringStatus(
    devicesData: DeviceData[],
    deviceMonitoringStatus: DeviceMonitoringStatus
  ) {
    return devicesData.map(device => {
      const {device_ip} = device
      const isMonitoring = deviceMonitoringStatus?.[device_ip] || false
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
    this.setState({isLoading: true})

    try {
      const {data} = await deleteDevice({devices_ids: idList})

      if (data?.failed_devices && data?.failed_devices?.length > 0) {
        this.handleDeleteDevicesErrorWithFailedDevices(data?.failed_devices)
        this.reFreshStateAfterDeleteDevices()
        return
      }

      this.props.notify(notifyDeleteDevicesSucceeded())
      this.reFreshStateAfterDeleteDevices()
    } catch (error) {
      this.props.notify(notifyDeleteDevicesFailed(parseErrorMessage(error)))
      this.reFreshStateAfterDeleteDevices()
    }
  }

  private reFreshStateAfterDeleteDevices = async () => {
    this.setState({checkedArray: [], isLoading: false})

    this.getDeviceAJAX()
    this.getNetworkDeviceOrganizationsAJAX()
  }

  private handleDeleteDevicesErrorWithFailedDevices = (
    failedDevices: FailedDevice[]
  ) => {
    const failedMessage = this.getFailedDevicesErrorMessage(failedDevices)

    this.props.notify(notifyDeleteDevicesFailed(failedMessage))
  }

  private getFailedDevicesErrorMessage = (
    failedDevices: FailedDevice[]
  ): string => {
    const limit = 5
    let messages = ''

    if (failedDevices) {
      messages = failedDevices
        .slice(0, limit)
        .map(
          device =>
            `${device?.device_id ?? 'Unknown Device'}: ${
              device?.errorMessage ?? ''
            }`
        )
        .join('; ')
    }

    if (failedDevices && failedDevices.length > limit) {
      messages += `;  Total ${failedDevices.length} devices failed.`
    }

    return `${messages}`
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

  private reLearnSetting = () => {
    this.setState({
      isLearningSettingModalVisibility: true,
    })
  }

  private getNetworkDeviceOrganizationsAJAX = async () => {
    const {organizations} = this.props

    try {
      const {data} = await getAllDevicesOrg()
      const networkDeviceOrganization = data?.organizations || []
      const networkDeviceOrganizationStatus = getNetworkDeviceOrganizationStatus(
        networkDeviceOrganization,
        organizations
      )

      this.setState({
        networkDeviceOrganizationStatus,
        orgLearningModel: networkDeviceOrganization,
      })
    } catch (error) {
      console.error(parseErrorMessage(error))
    }
  }

  private handleDismissImportDeviceModalOverlay = (): void => {
    this.setState({
      importDeviceWizardVisibility: false,
    })
  }

  private setDeviceManagementIsLoading = (isLoading: boolean) => {
    this.setState({isLoading})
  }

  private initializeCheckedArray = () => {
    this.setState({checkedArray: []})
  }

  private getKapacitorsFromSelectedSource = async (source: Source) => {
    if (!source) {
      this.setState({kapacitors: []})
      return
    }

    try {
      const kapacitors = await getKapacitors(source)

      if (!kapacitors) {
        this.setState({kapacitors: []})
        return
      }

      this.setState({kapacitors})
    } catch (error) {
      this.setState({kapacitors: []})
      this.props.notify(notifyKapacitorConnectionFailed())
    }
  }
}

const mstp = ({adminCloudHub: {organizations}, auth, links, sources, app}) => ({
  organizations,
  isUsingAuth: auth.isUsingAuth,
  auth,
  me: auth.me,
  links,
  sources,
  timeZone: app.persisted.timeZone,
})

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
  openShell: bindActionCreators(openShell, dispatch),
  openModal: bindActionCreators(openModal, dispatch),
  closeModal: bindActionCreators(closeModal, dispatch),
})

export default connect(mstp, mdtp, null)(DeviceManagement)
