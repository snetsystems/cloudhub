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
  selectedArrayById,
} from 'src/device_management/utils'
import {getDeep} from 'src/utils/wrappers'
import {generateForHosts} from 'src/utils/tempVars'

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

interface Props {
  auth: Auth
  source: Source
  sources: Source[]
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
  isLearningSettingModalVisibility: boolean
  deviceData: DeviceData[]
  selectedDeviceData: DeviceData
  checkedArray: string[]
  orgLearningModel: DevicesOrgData[]
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

  public componentDidMount(): void {
    try {
      this.getDeviceAJAX()
      this.getNetworkDeviceOrganizationsAJAX()
      this.fetchDeviceMonitoringStatus()
      this.getKapacitors()
    } catch (error) {
      console.error(error?.message || 'Unknown Error')
      throw error
    }
  }

  public componentWillUnmount() {
    this.isComponentMounted = false
  }

  public render() {
    const {me, organizations, isUsingAuth, source} = this.props
    const {
      data,
      deviceMonitoringStatus,
      deviceConnectionVisibility,
      deviceConnectionStatus,
      importDeviceWizardVisibility,
      selectedDeviceData,
      checkedArray,
      isLearningSettingModalVisibility,
      orgLearningModel,
      applyMonitoringModalVisibility,
      learningModelModalVisibility,
    } = this.state
    const updatedDeviceData = this.getDeviceMonitoringStatus(
      data,
      deviceMonitoringStatus
    )

    return (
      <>
        <div className="device-management--wrapper">
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
                importDevice={this.importDevice}
                connectDevice={this.connectDevice}
                reLearnSetting={this.reLearnSetting}
                checkedArray={checkedArray}
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
          getDeviceAJAX={this.getDeviceAJAX}
          getNetworkDeviceOrganizationsAJAX={
            this.getNetworkDeviceOrganizationsAJAX
          }
        />
        <ImportDevicePage
          isVisible={importDeviceWizardVisibility}
          organizations={organizations}
          onDismissOverlay={this.handleDismissImportDeviceModalOverlay}
          notify={this.props.notify}
          setDeviceManagementIsLoading={this.setDeviceManagementIsLoading}
          getDeviceAJAX={this.getDeviceAJAX}
          getNetworkDeviceOrganizationsAJAX={
            this.getNetworkDeviceOrganizationsAJAX
          }
        />
        <LearningSettingModal
          isVisible={isLearningSettingModalVisibility}
          orgLearningModel={orgLearningModel}
          notify={this.props.notify}
          onClose={this.onCloseLearningSettingModal}
          source={source}
          kapacitors={this.state.kapacitors}
          getDeviceAJAX={this.getDeviceAJAX}
          getNetworkDeviceOrganizationsAJAX={
            this.getNetworkDeviceOrganizationsAJAX
          }
          setDeviceManagementIsLoading={this.setDeviceManagementIsLoading}
        />
        <ApplyMonitoringModal
          isVisible={applyMonitoringModalVisibility}
          onDismissOverlay={this.handleDismissApplyMonitoringModal}
          deviceData={selectedArrayById(updatedDeviceData, checkedArray, 'id')}
          notify={this.props.notify}
          getDeviceAJAX={this.getDeviceAJAX}
          getNetworkDeviceOrganizationsAJAX={
            this.getNetworkDeviceOrganizationsAJAX
          }
          setDeviceManagementIsLoading={this.setDeviceManagementIsLoading}
          initializeCheckedArray={this.initializeCheckedArray}
        />
        <ApplyLearningModal
          isVisible={learningModelModalVisibility}
          onDismissOverlay={this.handleDismissLearningModelModal}
          deviceData={selectedArrayById(updatedDeviceData, checkedArray, 'id')}
          notify={this.props.notify}
          getDeviceAJAX={this.getDeviceAJAX}
          getNetworkDeviceOrganizationsAJAX={
            this.getNetworkDeviceOrganizationsAJAX
          }
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
      const convertedDeviceData = convertDeviceDataOrganizationIDToName(
        data.devices,
        organizations
      ) as DeviceData[]

      this.setState({data: convertedDeviceData})
    } catch (error) {
      console.error(
        notifyFetchDeviceListError(error?.message || 'Unknown Error')
      )
    }
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
        notifyFetchDeviceMonitoringStatusFailed(
          error?.message || 'Unknown Error'
        )
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
      await deleteDevice({devices_ids: idList})

      this.props.notify(notifyDeleteDevicesSucceeded())
      this.getDeviceAJAX()
      this.getNetworkDeviceOrganizationsAJAX()
      this.setState({checkedArray: [], isLoading: false})
    } catch (error) {
      this.props.notify(
        notifyDeleteDevicesFailed(error?.message || 'Unknown Error')
      )
      this.getDeviceAJAX()
      this.getNetworkDeviceOrganizationsAJAX()
      this.setState({checkedArray: [], isLoading: false})
    }
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
    try {
      const {data} = await getAllDevicesOrg()
      const networkDeviceOrganization = data?.organizations || []

      this.setState({
        orgLearningModel: networkDeviceOrganization,
      })
    } catch (error) {
      console.error(error?.message || 'Unknown Error')
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

  private getKapacitors = async () => {
    const {source, sources} = this.props

    try {
      const currentSource = sources.find(s => s.id === source.id)
      const kapacitors = await getKapacitors(currentSource)

      this.setState({kapacitors})
    } catch (error) {
      this.props.notify(notifyKapacitorConnectionFailed())
    }
  }
}

const mstp = ({adminCloudHub: {organizations}, auth, links, sources}) => ({
  organizations,
  isUsingAuth: auth.isUsingAuth,
  auth,
  me: auth.me,
  links,
  sources,
})

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
  openShell: bindActionCreators(openShell, dispatch),
  openModal: bindActionCreators(openModal, dispatch),
  closeModal: bindActionCreators(closeModal, dispatch),
})

export default connect(mstp, mdtp, null)(DeviceManagement)
