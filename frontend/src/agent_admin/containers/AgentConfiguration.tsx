// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentConfigurationTable from 'src/agent_admin/components/AgentConfigurationTable'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import AgentCodeEditor from 'src/agent_admin/components/AgentCodeEditor'
import AgentToolbarFunction from 'src/agent_admin/components/AgentToolbarFunction'
import PageSpinner from 'src/shared/components/PageSpinner'
import {globalSetting} from 'src/agent_admin/help'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// APIs
import {
  getMinionKeyListAllAsync,
  runLocalServiceStartTelegraf,
  runLocalServiceStopTelegraf,
  getLocalFileRead,
  getLocalFileWrite,
  runLocalServiceReStartTelegraf,
  getLocalServiceGetRunning,
  getRunnerSaltCmdTelegraf,
} from 'src/agent_admin/apis'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifyAgentSucceeded} from 'src/agent_admin/components/Notifications'

// Constants
import {HANDLE_HORIZONTAL, HANDLE_VERTICAL} from 'src/shared/constants'

// Types
import {RemoteDataState, Notification, NotificationFunc} from 'src/types'
import {Minion} from 'src/agent_admin/type'

interface Props {
  notify: (message: Notification | NotificationFunc) => void
  currentUrl: string
  isUserAuthorized: boolean
}

interface State {
  MinionsObject: {[x: string]: Minion}
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
  selectHost: string
  responseMessage: string
  defaultService: string[]
  focusedHost: string
}

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
      MinionsObject: {},
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
      selectHost: '',
      responseMessage: '',
      focusedHost: '',
      defaultService: serviceMeasure,
    }
  }

  getWheelKeyListAll = async (userDoing: string) => {
    const hostListObject = await getMinionKeyListAllAsync()
    const {notify} = this.props

    this.setState({
      MinionsObject: hostListObject,
      configPageStatus: RemoteDataState.Done,
      collectorConfigStatus: RemoteDataState.Done,
    })

    notify(notifyAgentSucceeded(userDoing))
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

  public onClickTableRowCall = (host: string, ip: string) => () => {
    this.setState({
      configPageStatus: RemoteDataState.Loading,
      measurementsStatus: RemoteDataState.Loading,
      collectorConfigStatus: RemoteDataState.Loading,
      focusedHost: host,
    })

    localStorage.setItem('AgentPage', JSON.stringify({focusedHost: host}))

    const getLocalFileReadPromise = getLocalFileRead(host)

    getLocalFileReadPromise.then(pLocalFileReadData => {
      this.setState({
        configScript: pLocalFileReadData.data.return[0][host],
        selectHost: host,
        collectorConfigStatus: RemoteDataState.Done,
        configPageStatus: RemoteDataState.Done,
      })
      this.props.notify(notifyAgentSucceeded('Get Agent Config'))
    })

    const getLocalServiceGetRunningPromise = getLocalServiceGetRunning(host)

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
        measurementsTitle: host + '-' + ip,
        measurementsStatus: RemoteDataState.Done,
      })
    })
  }

  public onClickActionCall = (host: string, isRunning: boolean) => () => {
    if (isRunning === false) {
      const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
        host
      )

      getLocalServiceStartTelegrafPromise.then(() => {
        this.getWheelKeyListAll('start')
      })
    } else {
      const getLocalServiceStopTelegrafPromise = runLocalServiceStopTelegraf(
        host
      )

      getLocalServiceStopTelegrafPromise.then(() => {
        this.getWheelKeyListAll('stop')
      })
    }
  }

  public onClickApplyCall = () => {
    const {selectHost, configScript} = this.state
    this.setState({
      configPageStatus: RemoteDataState.Loading,
      collectorConfigStatus: RemoteDataState.Loading,
    })

    const getLocalFileWritePromise = getLocalFileWrite(selectHost, configScript)

    getLocalFileWritePromise.then(pLocalFileWriteData => {
      this.setState({
        responseMessage: pLocalFileWriteData.data.return[0][selectHost],
      })

      const getLocalServiceReStartTelegrafPromise = runLocalServiceReStartTelegraf(
        selectHost
      )

      getLocalServiceReStartTelegrafPromise.then(() => {
        this.getWheelKeyListAll('apply')
      })
    })
  }

  public async componentDidMount() {
    this.getWheelKeyListAll('load')
    this.setState({configPageStatus: RemoteDataState.Loading})

    let localStorageDummy =
      localStorage.getItem('AgentPage') === null
        ? localStorage.setItem('AgentPage', JSON.stringify({focusedHost: ''}))
        : JSON.parse(localStorage.getItem('AgentPage'))

    console.log('localStorageDummy', localStorageDummy.focusedHost)
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
    console.log(_thisProps.name)

    const {serviceMeasurements, defaultMeasurements} = this.state
    const filterdMeasureName = Object.keys(measureMatch).filter(k =>
      _.includes(Object.values(measureMatch[Number(k)])[0], _thisProps.name)
    )
    console.log('serviceMeasurements', serviceMeasurements)

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

  private handleServiceClose = () => {
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

  private handleDefaultClose = () => {
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

  private horizontalHandleResize = (horizontalProportions: number[]) => {
    this.setState({horizontalProportions})
  }

  private verticalHandleResize = (verticalProportions: number[]) => {
    this.setState({verticalProportions})
  }

  private onChangeScript = (script: string): void => {
    this.setState({configScript: script})
  }

  private renderAgentPageTop = () => {
    const {MinionsObject, configPageStatus, focusedHost} = this.state

    return (
      <AgentConfigurationTable
        minions={_.values(MinionsObject)}
        configPageStatus={configPageStatus}
        onClickTableRow={this.onClickTableRowCall}
        onClickAction={this.onClickActionCall}
        focusedHost={focusedHost}
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
            className="panel-title"
            style={{
              width: '100%',
            }}
          >
            measurements
            <div className="measurements-title" style={{}}>
              {measurementsTitle}
            </div>
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
    const {collectorConfigStatus} = this.state
    return (
      <div className="panel">
        {collectorConfigStatus === RemoteDataState.Loading
          ? this.LoadingState
          : null}
        <div className="panel-heading">
          <h2 className="panel-title">collector.conf</h2>
          <div>
            <button
              className="btn btn-inline_block btn-default agent--btn"
              onClick={this.onClickApplyCall}
            >
              APPLY
            </button>
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
}

const mdtp = {
  notify: notifyAction,
}

export default connect(null, mdtp)(AgentConfiguration)
