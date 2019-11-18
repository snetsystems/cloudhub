import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentControlTable from 'src/agent_admin/components/AgentControlTable'
import AgentControlConsole from 'src/agent_admin/components/AgentControlConsole'

import {ErrorHandling} from 'src/shared/decorators/errors'

// APIs
import {
  getMinionAcceptKeyListAll,
  getMinionsIP,
  getMinionsOS,
  getTelegrafInstalled,
  getTelegrafServiceStatus,
  runLocalServiceStartTelegraf,
  runLocalServiceStopTelegraf,
  runLocalCpGetDirTelegraf,
  runLocalPkgInstallTelegraf,
} from 'src/agent_admin/apis'

//const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

// Types
import {Minion} from 'src/types'

interface Props {
  currentUrl: string
}

interface State {
  MinionsObject: {[x: string]: Minion}
  proportions: Readonly<{}>
  minionLog: string
}

@ErrorHandling
class AgentControl extends PureComponent<Props, State> {
  constructor(props) {
    super(props)
    this.state = {
      minionLog: 'not load log',
      proportions: [0.43, 0.57],
      MinionsObject: {},
    }
  }

  getWheelKeyListAll = async () => {
    const response = await getMinionAcceptKeyListAll()

    const updateMinionsIP = await getMinionsIP(response)

    const updateMinionsOS = await getMinionsOS(updateMinionsIP)

    //this.setState({MinionsObject: updateMinionsOS})

    const updateInstalled = await getTelegrafInstalled(updateMinionsOS)

    //this.setState({MinionsObject: updateInstalled})

    const updateServiceStatus = await getTelegrafServiceStatus(updateInstalled)

    this.setState({MinionsObject: updateServiceStatus})
  }

  public async componentDidMount() {
    this.getWheelKeyListAll()

    console.debug('componentDidMount')
  }

  public onClickTableRowCall() {
    return console.log('row Called', this)
  }

  public onClickActionCall = (host: string, isRunning: boolean) => () => {
    if (isRunning === false) {
      const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
        host
      )

      getLocalServiceStartTelegrafPromise.then(
        pLocalServiceStartTelegrafData => {
          console.log(pLocalServiceStartTelegrafData)
          this.setState({
            minionLog: JSON.stringify(
              pLocalServiceStartTelegrafData.data.return[0],
              null,
              4
            ),
          })
          this.getWheelKeyListAll()
        }
      )
    } else {
      const getLocalServiceStopTelegrafPromise = runLocalServiceStopTelegraf(
        host
      )

      getLocalServiceStopTelegrafPromise.then(pLocalServiceStopTelegrafData => {
        console.log(pLocalServiceStopTelegrafData)
        this.setState({
          minionLog: JSON.stringify(
            pLocalServiceStopTelegrafData.data.return[0],
            null,
            4
          ),
        })
        this.getWheelKeyListAll()
      })
    }
    // return console.log('action Called', host, isRunning)
  }

  public onClickRunCall = (host: string) => {
    const getLocalServiceStartTelegrafPromise = runLocalServiceStartTelegraf(
      host
    )

    getLocalServiceStartTelegrafPromise.then(pLocalServiceStartTelegrafData => {
      console.log(pLocalServiceStartTelegrafData)
      this.setState({
        minionLog: JSON.stringify(
          pLocalServiceStartTelegrafData.data.return[0],
          null,
          4
        ),
      })
      this.getWheelKeyListAll()
    })
    // return console.log('Run Called', this)
  }

  public onClickStopCall = (host: string) => {
    const getLocalServiceStopTelegrafPromise = runLocalServiceStopTelegraf(host)

    getLocalServiceStopTelegrafPromise.then(pLocalServiceStopTelegrafData => {
      console.log(pLocalServiceStopTelegrafData)
      this.setState({
        minionLog: JSON.stringify(
          pLocalServiceStopTelegrafData.data.return[0],
          null,
          4
        ),
      })
      this.getWheelKeyListAll()
    })
    // return console.log('Stop Called', this)
  }

  public onClickInstallCall = (host: string) => {
    const getLocalCpGetDirTelegrafPromise = runLocalCpGetDirTelegraf(host)

    getLocalCpGetDirTelegrafPromise.then(pLocalCpGetDirTelegrafData => {
      console.log('getLocalCpGetDirTelegrafPromise')
      console.log(pLocalCpGetDirTelegrafData.data.return[0])
      this.setState({
        minionLog: JSON.stringify(
          pLocalCpGetDirTelegrafData.data.return,
          null,
          4
        ),
      })

      const getLocalPkgInstallTelegrafPromise = runLocalPkgInstallTelegraf(host)

      getLocalPkgInstallTelegrafPromise.then(pLocalPkgInstallTelegrafData => {
        console.log(pLocalPkgInstallTelegrafData.data.return[0])
        this.setState({
          minionLog: JSON.stringify(
            pLocalPkgInstallTelegrafData.data.return[0],
            null,
            4
          ),
        })
      })

      this.getWheelKeyListAll()
    })

    //return console.log('Install Called', this)
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
              onResize={this.handleResize}
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

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
  }

  private renderAgentPageTop = () => {
    const {MinionsObject} = this.state

    return (
      <AgentControlTable
        minions={_.values(MinionsObject)}
        onClickTableRow={this.onClickTableRowCall}
        onClickAction={this.onClickActionCall}
        onClickRun={this.onClickRunCall}
        onClickStop={this.onClickStopCall}
        onClickInstall={this.onClickInstallCall}
      />
    )
  }

  private renderAgentPageBottom = () => {
    const {minionLog} = this.state
    return <AgentControlConsole res={minionLog} />
  }

  private get horizontalDivisions() {
    const {proportions} = this.state
    const [topSize, bottomSize] = proportions

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
}

export default AgentControl
