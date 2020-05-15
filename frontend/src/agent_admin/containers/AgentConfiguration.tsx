// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'
import _ from 'lodash'
import * as TOML from '@iarna/toml'
import {IInstance} from 'react-codemirror2'
import {EditorChange} from 'codemirror'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentConfigurationTable from 'src/agent_admin/components/AgentConfigurationTable'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import AgentCodeEditor from 'src/agent_admin/components/AgentCodeEditor'
import AgentToolbarFunction from 'src/agent_admin/components/AgentToolbarFunction'
import AgentConfigModal from 'src/agent_admin/components/AgentConfigModal'
import PageSpinner from 'src/shared/components/PageSpinner'
import Dropdown from 'src/shared/components/Dropdown'
import {globalSetting} from 'src/agent_admin/help'

// Middleware
import {
  setLocalStorage,
  getLocalStorage,
  verifyLocalStorage,
  //removeLocalStorage,
} from 'src/shared/middleware/localStorage'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// APIs
import {getMinionKeyListAllAsync} from 'src/agent_admin/apis'

// SaltStack
import {
  runLocalServiceStartTelegraf,
  runLocalServiceStopTelegraf,
  getLocalFileRead,
  getLocalFileWrite,
  runLocalServiceReStartTelegraf,
  getLocalServiceGetRunning,
  getRunnerSaltCmdTelegraf,
} from 'src/shared/apis/saltStack'

// Notification
import {loadOrganizationsAsync} from 'src/admin/actions/cloudhub'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyAgentApplySucceeded,
  notifyAgentConfigWrong,
  notifyAgentConfigNoMatchGroup,
  notifyAgentConfigDBNameWrong,
  notifyAgentConfigHostNameWrong,
  notifyAgentConfigHostNameChanged,
} from 'src/shared/copy/notifications'

// Constants
import {HANDLE_HORIZONTAL, HANDLE_VERTICAL} from 'src/shared/constants'
import {GET_STATUS} from 'src/agent_admin/constants'

// Types
import {
  Links,
  Me,
  Organization,
  RemoteDataState,
  Notification,
  NotificationFunc,
} from 'src/types'
import {MinionsObject} from 'src/agent_admin/type'

interface Props {
  notify: (message: Notification | NotificationFunc) => void
  loadOrganizations: (link: string) => void
  links: Links
  me: Me
  organizations: Organization[]
  currentUrl: string
  isUserAuthorized: boolean
  saltMasterUrl: string
  saltMasterToken: string
  minionsObject: MinionsObject
  minionsStatus: RemoteDataState
  handleGetMinionKeyListAll: () => void
}

interface State {
  configPageStatus: RemoteDataState
  measurementsStatus: RemoteDataState
  collectorConfigStatus: RemoteDataState
  measurementsTitle: string
  serviceMeasurements: {
    name: string
    isActivity: boolean
  }[]
  defaultMeasurements: {
    name: string
    isActivity: boolean
  }[]
  horizontalProportions: number[]
  verticalProportions: number[]
  description: string
  focusedMeasure: string
  focusedMeasurePosition: {top: number; left: number}
  configScript: string
  responseMessage: string
  defaultService: string[]
  focusedHost: string
  focusedHostIp: string
  isInitEditor: boolean
  isApplyBtnDisabled: boolean
  isGetLocalStorage: boolean
  isModalVisible: boolean
  isCollectorInstalled: boolean
  isModalCall: boolean
  selectedOrg: string
}

interface LocalStorageAgentConfig {
  focusedHost?: string
  focusedHostIp?: string
  configScript?: string
  isApplyBtnDisabled?: boolean
}

const DEFAULT_DROPDOWN_TEXT = 'Select Database(= Group)'

const defaultMeasurementsData = [
  'global setting',
  'cpu',
  'disk',
  'diskio',
  'mem',
  'net',
  'netstat',
  'ping',
  'processes',
  'system',
  'swap',
  'temp',
]

const measureMatch = [
  {mysql: ['mysql', 'mysqld']},
  {mssql: ['mssql', 'MSSQLSERVER']},
  {influxdb: ['influxdb']},
  {mongodb: ['mongodb']},
  {postgresql: ['postgresql']},
  {redis: ['redis']},
  {oracle: ['oracle']},
  {activemq: ['activemq']},
  {rabbitmq: ['rabbitmq']},
  {kafka: ['kafka']},
  {zookeeper: ['zookeeper']},
  {tomcat: ['tomcat']},
  {apache: ['apache', 'apache2', 'httpd']},
  {nginx: ['nginx']},
  {iis: ['Iisadmin', 'Msftpsvc', 'Nntpsvc', 'Smtpsvc', 'W3svc']},
  {system: ['system']},
  {win_system: ['win_system']},
  {docker: ['docker']},
]

const serviceMeasure = _.uniq(
  _.flattenDeep(
    _.concat(
      [],
      Object.keys(measureMatch).map(k => Object.keys(measureMatch[k])),
      Object.keys(measureMatch).map(k => Object.values(measureMatch[k]))
    )
  )
)

interface measureMatch {
  measureMatch: [
    {mysql: string[]},
    {mssql: string[]},
    {influxdb: string[]},
    {postgresql: string[]},
    {oracle: string[]},
    {activemq: string[]},
    {rabbitmq: string[]},
    {kafka: string[]},
    {zookeeper: string[]},
    {tomcat: string[]},
    {apache: string[]},
    {nginx: string[]},
    {iis: string[]},
    {system: string[]},
    {win_system: string[]},
    {docker: string[]},
    string
  ]
}

@ErrorHandling
export class AgentConfiguration extends PureComponent<
  Props,
  State,
  measureMatch
> {
  constructor(props: Props) {
    super(props)
    this.state = {
      // MinionsObject: {},
      configPageStatus: RemoteDataState.NotStarted,
      measurementsStatus: RemoteDataState.NotStarted,
      collectorConfigStatus: RemoteDataState.NotStarted,
      measurementsTitle: '',
      serviceMeasurements: [],
      defaultMeasurements: [],
      horizontalProportions: [0.43, 0.57],
      verticalProportions: [0.43, 0.57],
      description: '',
      focusedMeasure: '',
      focusedMeasurePosition: {top: null, left: null},
      configScript: '',
      responseMessage: '',
      focusedHost: '',
      focusedHostIp: '',
      defaultService: serviceMeasure,
      isInitEditor: true,
      isApplyBtnDisabled: true,
      isGetLocalStorage: false,
      isModalVisible: false,
      isCollectorInstalled: false,
      isModalCall: false,
      selectedOrg: DEFAULT_DROPDOWN_TEXT,
    }
  }

  getWheelKeyListAll = async () => {
    const {saltMasterUrl, saltMasterToken} = this.props
    const hostListObject = await getMinionKeyListAllAsync(
      saltMasterUrl,
      saltMasterToken
    )

    const isInstallCheck = _.filter(hostListObject, ['isInstall', true])

    if (!this.state.isModalCall) {
      const getItem: LocalStorageAgentConfig = getLocalStorage(
        'AgentConfigPage'
      )
      const {isApplyBtnDisabled, focusedHost} = getItem
      const getHostCompare = _.find(isInstallCheck, ['host', focusedHost])

      if (!isApplyBtnDisabled && Boolean(getHostCompare)) {
        this.setState({
          isModalCall: true,
          isModalVisible: true,
          isGetLocalStorage: !isApplyBtnDisabled,
        })
      }
    }

    this.setState({
      isCollectorInstalled: Boolean(isInstallCheck.length),
      // MinionsObject: hostListObject,
      configPageStatus: RemoteDataState.Done,
      collectorConfigStatus: RemoteDataState.Done,
      measurementsStatus: RemoteDataState.Done,
    })
  }

  public componentWillMount() {
    this.setState({configPageStatus: this.props.minionsStatus})
  }

  public componentDidMount() {
    const {minionsObject} = this.props
    const isInstallCheck = _.filter(minionsObject, ['isInstall', true])

    if (!this.state.isModalCall) {
      const getItem: LocalStorageAgentConfig = getLocalStorage(
        'AgentConfigPage'
      )
      const {isApplyBtnDisabled, focusedHost} = getItem
      const getHostCompare = _.find(isInstallCheck, ['host', focusedHost])

      if (!isApplyBtnDisabled && Boolean(getHostCompare)) {
        this.setState({
          isModalCall: true,
          isModalVisible: true,
          isGetLocalStorage: !isApplyBtnDisabled,
        })
      }
    }

    this.setState({
      configPageStatus: this.props.minionsStatus,
      isCollectorInstalled: Boolean(isInstallCheck.length),
    })
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.minionsObject !== this.props.minionsObject) {
      const {links, loadOrganizations, minionsObject} = this.props
      loadOrganizations(links.organizations)

      const isInstallCheck = _.filter(minionsObject, ['isInstall', true])

      if (!this.state.isModalCall) {
        const getItem: LocalStorageAgentConfig = getLocalStorage(
          'AgentConfigPage'
        )
        const {isApplyBtnDisabled, focusedHost} = getItem
        const getHostCompare = _.find(isInstallCheck, ['host', focusedHost])

        if (!isApplyBtnDisabled && Boolean(getHostCompare)) {
          this.setState({
            isModalCall: true,
            isModalVisible: true,
            isGetLocalStorage: !isApplyBtnDisabled,
          })
        }
      }

      verifyLocalStorage(getLocalStorage, setLocalStorage, 'AgentConfigPage', {
        focusedHost: '',
        focusedHostIp: '',
        configScript: '',
        isApplyBtnDisabled: true,
      })

      this.setState({
        isCollectorInstalled: Boolean(isInstallCheck.length),
        // MinionsObject: hostListObject,
        configPageStatus: this.props.minionsStatus,
        collectorConfigStatus: RemoteDataState.Done,
        measurementsStatus: RemoteDataState.Done,
      })
    }
  }

  public componentWillUnmount() {
    const {
      focusedHost,
      focusedHostIp,
      configScript,
      isApplyBtnDisabled,
    } = this.state

    setLocalStorage('AgentConfigPage', {
      focusedHost: isApplyBtnDisabled ? '' : focusedHost,
      focusedHostIp: isApplyBtnDisabled ? '' : focusedHostIp,
      configScript: isApplyBtnDisabled ? '' : configScript,
      isApplyBtnDisabled,
    })
  }

  private get MeasurementsContent() {
    const {measurementsStatus} = this.state

    if (measurementsStatus === RemoteDataState.Error) {
      return this.ErrorState
    }

    return this.MeasurementsContentBody
  }

  private get CollectorConfigContent() {
    const {collectorConfigStatus} = this.state

    if (collectorConfigStatus === RemoteDataState.Error) {
      return this.ErrorState
    }

    return this.CollectorConfigBody
  }

  private get LoadingState(): JSX.Element {
    return (
      <div
        style={{
          position: 'absolute',
          zIndex: 7,
          backgroundColor: 'rgba(0,0,0,0.5)',
          width: '100%',
          height: '100%',
        }}
      >
        <PageSpinner />
      </div>
    )
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="generic-empty-state">
        <h4 style={{margin: '90px 0'}}>There was a problem loading data</h4>
      </div>
    )
  }

  public onClickTableRowCall = (host: string, ip: string): void => {
    if (this.state.focusedHost === host) return
    const {notify, saltMasterUrl, saltMasterToken} = this.props

    this.setState({
      configPageStatus: RemoteDataState.Loading,
      measurementsStatus: RemoteDataState.Loading,
      collectorConfigStatus: RemoteDataState.Loading,
      focusedHost: host,
      focusedHostIp: ip,
      isInitEditor: true,
      isGetLocalStorage: false,
    })

    const getLocalFileReadPromise = getLocalFileRead(
      saltMasterUrl,
      saltMasterToken,
      host
    )

    getLocalFileReadPromise.then(pLocalFileReadData => {
      const hostLocalFileReadData = pLocalFileReadData.data.return[0][
        host
      ].substring(0, pLocalFileReadData.data.return[0][host].lastIndexOf('\n'))

      const configObj = TOML.parse(hostLocalFileReadData)
      const agent: any = _.get(configObj, 'agent')

      let isChanged = false
      if (agent.hostname !== host) {
        notify(notifyAgentConfigHostNameChanged(agent.hostname, host))
        _.set(agent, 'hostname', host)
        isChanged = true
      }

      this.setState({
        configScript: TOML.stringify(configObj),
        isGetLocalStorage: isChanged,
        isApplyBtnDisabled: isChanged ? !isChanged : true,
        focusedHost: host,
        collectorConfigStatus: RemoteDataState.Done,
        configPageStatus: RemoteDataState.Done,
        selectedOrg: DEFAULT_DROPDOWN_TEXT,
      })
    })

    const getLocalServiceGetRunningPromise = getLocalServiceGetRunning(
      saltMasterUrl,
      saltMasterToken,
      host
    )

    getLocalServiceGetRunningPromise.then(pLocalServiceGetRunningData => {
      let getServiceRunning = this.state.defaultService
        .filter(m =>
          pLocalServiceGetRunningData.data.return[0][host].includes(m)
        )
        .map(sMeasure => {
          return {
            name: sMeasure,
            isActivity: false,
          }
        })

      let getDefaultMeasure = defaultMeasurementsData.map(dMeasure => {
        return {
          name: dMeasure,
          isActivity: false,
        }
      })

      this.setState({
        serviceMeasurements: getServiceRunning,
        defaultMeasurements: getDefaultMeasure,
        measurementsTitle: host + ' - ' + ip,
        measurementsStatus: RemoteDataState.Done,
      })
    })
  }

  public onClickActionCall = (host: string, isRunning: boolean) => {
    const {saltMasterUrl, saltMasterToken} = this.props
    this.setState({
      configPageStatus: RemoteDataState.Loading,
      measurementsStatus: RemoteDataState.Loading,
      collectorConfigStatus: RemoteDataState.Loading,
    })

    if (isRunning === false) {
      const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
        saltMasterUrl,
        saltMasterToken,
        host
      )

      getLocalServiceStartTelegrafPromise.then((): void => {
        this.getWheelKeyListAll()
      })
    } else {
      const getLocalServiceStopTelegrafPromise = runLocalServiceStopTelegraf(
        saltMasterUrl,
        saltMasterToken,
        host
      )

      getLocalServiceStopTelegrafPromise.then((): void => {
        this.getWheelKeyListAll()
      })
    }
  }

  public onClickApplyCall = () => {
    const {
      notify,
      saltMasterUrl,
      saltMasterToken,
      organizations,
      me,
    } = this.props
    const {focusedHost, configScript} = this.state

    let isCheckDone = true
    try {
      const configObj = TOML.parse(configScript)
      const influxdbs: any = _.get(configObj, 'outputs.influxdb')
      const agent: any = _.get(configObj, 'agent')

      if (me.superAdmin) {
        if (agent.hostname !== focusedHost) {
          notify(notifyAgentConfigHostNameWrong(focusedHost))
          isCheckDone = false
          return
        }

        influxdbs.forEach((db: any) => {
          const idx = organizations.findIndex(org => org.name === db.database)

          if (idx < 0) {
            notify(notifyAgentConfigNoMatchGroup(db.database))
            isCheckDone = false
            return
          }

          if (db.database !== me.currentOrganization.name) {
            notify(notifyAgentConfigDBNameWrong(me.currentOrganization.name))
            isCheckDone = false
            return
          }
        })
      }
    } catch (e) {
      notify(notifyAgentConfigWrong(e))
      return
    }

    if (!isCheckDone) return

    this.setState({
      configPageStatus: RemoteDataState.Loading,
      collectorConfigStatus: RemoteDataState.Loading,
    })

    const getLocalFileWritePromise = getLocalFileWrite(
      saltMasterUrl,
      saltMasterToken,
      focusedHost,
      configScript
    )

    getLocalFileWritePromise
      .then((pLocalFileWriteData): void => {
        this.setState({
          isApplyBtnDisabled: true,
          isGetLocalStorage: false,
          responseMessage: pLocalFileWriteData.data.return[0][focusedHost],
        })

        const getLocalServiceReStartTelegrafPromise = runLocalServiceReStartTelegraf(
          saltMasterUrl,
          saltMasterToken,
          focusedHost
        )

        getLocalServiceReStartTelegrafPromise
          .then((): void => {
            this.getWheelKeyListAll()
            notify(notifyAgentApplySucceeded('is applied'))
          })
          .catch(e => {
            console.error(e)
          })
      })
      .catch(e => {
        console.error(e)
      })
  }

  public getConfigInfo = (answer: boolean) => {
    const {saltMasterUrl, saltMasterToken} = this.props
    const getItem = getLocalStorage('AgentConfigPage')
    const {
      configScript,
      focusedHost,
      focusedHostIp,
      isApplyBtnDisabled,
    } = getItem

    if (answer) {
      this.setState({
        configScript,
        focusedHost,
        focusedHostIp,
        isApplyBtnDisabled,
        isInitEditor: false,
        measurementsStatus: RemoteDataState.Loading,
      })

      //await this.getWheelKeyListAll()

      const getLocalServiceGetRunningPromise = getLocalServiceGetRunning(
        saltMasterUrl,
        saltMasterToken,
        focusedHost
      )
      getLocalServiceGetRunningPromise.then(pLocalServiceGetRunningData => {
        let getServiceRunning = this.state.defaultService
          .filter(m =>
            pLocalServiceGetRunningData.data.return[0][focusedHost].includes(m)
          )
          .map(sMeasure => {
            return {
              name: sMeasure,
              isActivity: false,
            }
          })

        let getDefaultMeasure = defaultMeasurementsData.map(dMeasure => {
          return {
            name: dMeasure,
            isActivity: false,
          }
        })

        this.setState({
          serviceMeasurements: getServiceRunning,
          defaultMeasurements: getDefaultMeasure,
          measurementsStatus: RemoteDataState.Done,
          measurementsTitle: focusedHost + '-' + focusedHostIp,
        })
      })
    } else {
      setLocalStorage('AgentConfigPage', {
        focusedHost: '',
        focusedHostIp: '',
        configScript: '',
        isApplyBtnDisabled: true,
      })
    }
  }

  render() {
    const {isUserAuthorized} = this.props
    return (
      <>
        {isUserAuthorized ? (
          <div className="panel panel-solid">
            <Threesizer
              orientation={HANDLE_HORIZONTAL}
              divisions={this.horizontalDivisions}
              onResize={this.horizontalHandleResize}
            />
            <AgentConfigModal
              visible={this.state.isModalVisible}
              headingTitle={'Confirm'}
              message={'Do you want to import previous changes?'}
              cancelText={'No'}
              confirmText={'Yes'}
              onCancel={() => {
                this.setState({isModalVisible: !this.state.isModalVisible})
                this.getConfigInfo(false)
              }}
              onConfirm={() => {
                this.setState({isModalVisible: !this.state.isModalVisible})
                this.getConfigInfo(true)
              }}
            />
          </div>
        ) : (
          <div
            className="generic-empty-state"
            style={{backgroundColor: '#292933'}}
          >
            <h4>Not Allowed User</h4>
          </div>
        )}
      </>
    )
  }

  private handleFocusedServiceMeasure = ({
    clickPosition,
    _thisProps,
  }: {
    clickPosition: {top: number; left: number}
    _thisProps: {name: string; idx: number}
  }) => {
    const {saltMasterUrl, saltMasterToken} = this.props
    const {serviceMeasurements, defaultMeasurements} = this.state
    const filterdMeasureName = Object.keys(measureMatch).filter(k =>
      _.includes(Object.values(measureMatch[Number(k)])[0], _thisProps.name)
    )

    const measureName =
      filterdMeasureName.length === 0
        ? _thisProps.name
        : Object.keys(measureMatch[Number(filterdMeasureName)])[0]

    const mapServiceMeasurements = serviceMeasurements.map(m => {
      m.isActivity = false
      return m
    })

    const mapDefaultMeasurements = defaultMeasurements.map(m => {
      m.isActivity = false
      return m
    })

    serviceMeasurements[_thisProps.idx].isActivity === false
      ? (serviceMeasurements[_thisProps.idx].isActivity = true)
      : (serviceMeasurements[_thisProps.idx].isActivity = false)

    const getRunnerSaltCmdTelegrafPromise = getRunnerSaltCmdTelegraf(
      saltMasterUrl,
      saltMasterToken,
      measureName
    )

    getRunnerSaltCmdTelegrafPromise.then(pRunnerSaltCmdTelegrafData => {
      this.setState({
        serviceMeasurements: [...mapServiceMeasurements],
        defaultMeasurements: [...mapDefaultMeasurements],
        focusedMeasure: measureName,
        focusedMeasurePosition: clickPosition,
        description: pRunnerSaltCmdTelegrafData.data.return[0],
      })
    })
  }

  private handleFocusedDefaultMeasure = ({clickPosition, _thisProps}) => {
    const {saltMasterUrl, saltMasterToken} = this.props
    const {defaultMeasurements, serviceMeasurements} = this.state

    const mapDefaultMeasurements = defaultMeasurements.map(m => {
      m.isActivity = false
      return m
    })

    const mapServiceMeasurements = serviceMeasurements.map(m => {
      m.isActivity = false
      return m
    })

    defaultMeasurements[_thisProps.idx].isActivity === false
      ? (defaultMeasurements[_thisProps.idx].isActivity = true)
      : (defaultMeasurements[_thisProps.idx].isActivity = false)

    if (_thisProps.name === 'global setting') {
      this.setState({
        defaultMeasurements: [...mapDefaultMeasurements],
        serviceMeasurements: [...mapServiceMeasurements],
        focusedMeasure: _thisProps.name,
        focusedMeasurePosition: clickPosition,
        description: globalSetting,
      })
    } else {
      const getRunnerSaltCmdTelegrafPromise = getRunnerSaltCmdTelegraf(
        saltMasterUrl,
        saltMasterToken,
        _thisProps.name
      )

      getRunnerSaltCmdTelegrafPromise.then(pRunnerSaltCmdTelegrafData => {
        this.setState({
          defaultMeasurements: [...mapDefaultMeasurements],
          serviceMeasurements: [...mapServiceMeasurements],
          focusedMeasure: _thisProps.name,
          focusedMeasurePosition: clickPosition,
          description: pRunnerSaltCmdTelegrafData.data.return[0],
        })
      })
    }
  }

  private handleServiceClose = (): void => {
    const {serviceMeasurements} = this.state

    const mapServiceMeasurements = serviceMeasurements.map(m => {
      m.isActivity = false
      return m
    })

    this.setState({
      serviceMeasurements: [...mapServiceMeasurements],
      focusedMeasure: '',
      focusedMeasurePosition: {top: null, left: null},
    })
  }

  private handleDefaultClose = (): void => {
    const {defaultMeasurements} = this.state

    const mapDefaultMeasurements = defaultMeasurements.map(m => {
      m.isActivity = false
      return m
    })

    this.setState({
      defaultMeasurements: [...mapDefaultMeasurements],
      focusedMeasure: '',
      focusedMeasurePosition: {top: null, left: null},
    })
  }

  private horizontalHandleResize = (horizontalProportions: number[]): void => {
    this.setState({horizontalProportions})
  }

  private verticalHandleResize = (verticalProportions: number[]): void => {
    this.setState({verticalProportions})
  }

  private onBeforeChangeScript = (
    __: IInstance,
    ___: EditorChange,
    script: string
  ) => {
    this.setState({
      isInitEditor: false,
      isApplyBtnDisabled: false,
      configScript: script,
    })
  }

  private onChangeScript = (_: IInstance, __: EditorChange, ___: string) => {
    const {isInitEditor, isGetLocalStorage} = this.state
    if (isInitEditor) {
      if (isGetLocalStorage) {
        this.setState({
          isApplyBtnDisabled: false,
          isInitEditor: false,
        })
      } else {
        this.setState({
          isApplyBtnDisabled: true,
          isInitEditor: false,
        })
      }
    } else {
      this.setState({
        isApplyBtnDisabled: false,
      })
    }
  }

  private renderAgentPageTop = () => {
    const {
      // MinionsObject,
      configPageStatus,
      focusedHost,
      isCollectorInstalled,
    } = this.state
    const {minionsObject} = this.props

    return (
      <AgentConfigurationTable
        minions={_.values(minionsObject)}
        configPageStatus={configPageStatus}
        onClickTableRow={this.onClickTableRowCall}
        onClickAction={this.onClickActionCall}
        focusedHost={focusedHost}
        isCollectorInstalled={isCollectorInstalled}
      />
    )
  }

  private renderAgentPageBottom = () => {
    return (
      <Threesizer
        orientation={HANDLE_VERTICAL}
        divisions={this.verticalDivisions}
        onResize={this.verticalHandleResize}
      />
    )
  }

  private Measurements() {
    const {measurementsTitle, measurementsStatus} = this.state
    return (
      <div className="panel">
        {measurementsStatus === RemoteDataState.Loading
          ? this.LoadingState
          : null}
        <div className="panel-heading">
          <h2
            className="panel-title use-user-select"
            style={{
              width: '100%',
            }}
          >
            measurements
            <div className="measurements-title">{measurementsTitle}</div>
          </h2>
        </div>
        <div className="panel-body">{this.MeasurementsContent}</div>
      </div>
    )
  }

  private get MeasurementsContentBody() {
    const {
      serviceMeasurements,
      defaultMeasurements,
      description,
      focusedMeasure,
      focusedMeasurePosition,
    } = this.state
    return (
      <FancyScrollbar>
        <div className="measurements-query-builder--contain">(Service)</div>
        <div className="query-builder--list">
          {serviceMeasurements.map(
            (v: {name: string; isActivity: boolean}, idx): JSX.Element => (
              <AgentToolbarFunction
                key={idx}
                name={v.name}
                isActivity={v.isActivity}
                idx={idx}
                handleFocusedMeasure={this.handleFocusedServiceMeasure}
                handleClose={this.handleServiceClose}
                description={description}
                focusedMeasure={focusedMeasure}
                focusedPosition={focusedMeasurePosition}
              />
            )
          )}
        </div>
        <div className={'default-measurements'}> (Default measurements)</div>
        <div className="query-builder--list">
          {defaultMeasurements.map((v, i) => {
            return (
              <AgentToolbarFunction
                name={v.name}
                isActivity={v.isActivity}
                key={i}
                idx={i}
                handleFocusedMeasure={this.handleFocusedDefaultMeasure.bind(
                  this
                )}
                handleClose={this.handleDefaultClose}
                description={description}
                focusedMeasure={focusedMeasure}
                focusedPosition={focusedMeasurePosition}
              />
            )
          })}
        </div>
      </FancyScrollbar>
    )
  }

  private CollectorConfig() {
    const {organizations, me} = this.props
    const {collectorConfigStatus, isApplyBtnDisabled, selectedOrg} = this.state

    let dropdownOrg: any = null
    if (organizations) {
      dropdownOrg = organizations.map(role => ({
        ...role,
        text: role.name,
      }))
    }

    return (
      <div className="panel">
        {collectorConfigStatus === RemoteDataState.Loading
          ? this.LoadingState
          : null}
        <div className="panel-heading">
          <h2 className="panel-title">collector.conf</h2>
          <div className="panel-heading">
            <div className="agent-select--button-box">
              {me.superAdmin ? (
                <Dropdown
                  items={dropdownOrg ? dropdownOrg : [{text: GET_STATUS.EMPTY}]}
                  onChoose={this.onChooseDropdown}
                  selected={selectedOrg}
                  className="dropdown-stretch top"
                />
              ) : null}
            </div>
            <div>
              <button
                className="btn btn-inline_block btn-default agent--btn"
                onClick={this.onClickApplyCall}
                disabled={isApplyBtnDisabled}
              >
                APPLY
              </button>
            </div>
          </div>
        </div>

        <div className="panel-body">{this.CollectorConfigContent}</div>
      </div>
    )
  }

  private get CollectorConfigBody() {
    const {configScript} = this.state
    return (
      <div className="collect-config--half">
        <AgentCodeEditor
          configScript={configScript}
          onBeforeChangeScript={this.onBeforeChangeScript}
          onChangeScript={this.onChangeScript}
        />
      </div>
    )
  }

  private get horizontalDivisions() {
    const {horizontalProportions} = this.state
    const [topSize, bottomSize] = horizontalProportions

    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: this.renderAgentPageTop,
        headerOrientation: HANDLE_HORIZONTAL,
        size: topSize,
      },
      {
        name: '',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: this.renderAgentPageBottom,
        headerOrientation: HANDLE_HORIZONTAL,
        size: bottomSize,
      },
    ]
  }

  private get verticalDivisions() {
    const {verticalProportions} = this.state
    const [rightSize, leftSize] = verticalProportions

    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: this.Measurements.bind(this),
        headerOrientation: HANDLE_VERTICAL,
        size: rightSize,
      },
      {
        name: '',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: this.CollectorConfig.bind(this),
        headerOrientation: HANDLE_VERTICAL,
        size: leftSize,
      },
    ]
  }

  private onChooseDropdown = (org: Organization) => {
    const {selectedOrg, configScript, focusedHost} = this.state

    if (selectedOrg === org.name) return

    const configObj = TOML.parse(configScript)
    const influxdbs: any = _.get(configObj, 'outputs.influxdb')
    const agent: any = _.get(configObj, 'agent')

    if (!influxdbs || !agent) {
      return
    }

    let isChanged = false

    influxdbs.forEach((influxdb: {database: string}) => {
      if (_.get(influxdb, 'database') !== org.name) {
        _.set(influxdb, 'database', org.name)
      }
    })

    if (_.get(agent, 'hostname') !== focusedHost) {
      _.set(agent, 'hostname', focusedHost)
    }

    const checker = _.some(
      _.map(influxdbs, m => m.database === org.name),
      false
    )

    if (!checker && _.get(agent, 'hostname') === focusedHost) {
      isChanged = true
    }

    if (isChanged)
      this.setState({
        selectedOrg: org.name,
        configScript: TOML.stringify(configObj),
      })
    else
      this.setState({
        selectedOrg: org.name,
      })
  }
}

const mstp = ({links, adminCloudHub: {organizations}, auth: {me}}) => ({
  links,
  organizations,
  me,
})

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
  loadOrganizations: bindActionCreators(loadOrganizationsAsync, dispatch),
})

export default connect(mstp, mdtp)(AgentConfiguration)
