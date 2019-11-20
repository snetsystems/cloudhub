import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentMinionsTable from 'src/agent_admin/components/AgentMinionsTable'
import AgentMinionsConsole from 'src/agent_admin/components/AgentMinionsConsole'
import AgentMinionsModal from 'src/agent_admin/components/AgentMinionsModal'

import {ErrorHandling} from 'src/shared/decorators/errors'

// APIs
import {
  getMinionKeyListAll,
  getMinionsIP,
  getMinionsOS,
  getLocalGrainsItem,
  runAcceptKey,
  runRejectKey,
  runDeleteKey,
} from 'src/agent_admin/apis'

//const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

// Types
import {Minion, RemoteDataState} from 'src/types'

interface Props {
  currentUrl: string
}
interface State {
  MinionsObject: {[x: string]: Minion}
  minionsPageStatus: RemoteDataState
  minionLog: string
  currentUrl: ''
  proportions: number[]
  focusedHost: string
}

@ErrorHandling
class AgentMinions extends PureComponent<Props, State> {
  constructor(props) {
    super(props)
    this.state = {
      minionLog: 'not load log',
      proportions: [0.43, 0.57],
      MinionsObject: {},
      currentUrl: '',
      minionsPageStatus: RemoteDataState.NotStarted,
      focusedHost: '',
    }
  }

  getWheelKeyListAll = async () => {
    const response = await getMinionKeyListAll()

    const updateMinionsIP = await getMinionsIP(response)

    const newMinions = await getMinionsOS(updateMinionsIP)

    this.setState({
      MinionsObject: newMinions,
      minionsPageStatus: RemoteDataState.Done,
    })
  }

  public async componentDidMount() {
    this.getWheelKeyListAll()

    this.setState({minionsPageStatus: RemoteDataState.Loading})

    console.debug('componentDidMount')
  }

  onClickTableRowCall = (host: string) => () => {
    this.setState({focusedHost: host})
    const getLocalGrainsItemPromise = getLocalGrainsItem(host)
    getLocalGrainsItemPromise.then(pLocalGrainsItemData => {
      this.setState({
        minionLog: JSON.stringify(
          pLocalGrainsItemData.data.return[0][host],
          null,
          4
        ),
      })
    })
  }

  handleWheelKeyCommand = (host: string, cmdstatus: string) => {
    console.log('handleWheelKeyCommand', host, cmdstatus)

    if (cmdstatus == 'ReJect') {
      const getWheelKeyCommandPromise = runRejectKey(host)

      getWheelKeyCommandPromise.then(pWheelKeyCommandData => {
        console.log(pWheelKeyCommandData)
        this.setState({
          minionLog: JSON.stringify(
            pWheelKeyCommandData.data.return[0],
            null,
            4
          ),
        })
        this.getWheelKeyListAll()
      })
    } else if (cmdstatus == 'Accept') {
      const getWheelKeyCommandPromise = runAcceptKey(host)

      getWheelKeyCommandPromise.then(pWheelKeyCommandData => {
        console.log(pWheelKeyCommandData)
        this.setState({
          minionLog: JSON.stringify(
            pWheelKeyCommandData.data.return[0],
            null,
            4
          ),
        })
        this.getWheelKeyListAll()
      })
    } else if (cmdstatus == 'Delete') {
      const getWheelKeyCommandPromise = runDeleteKey(host)

      getWheelKeyCommandPromise.then(pWheelKeyCommandData => {
        console.log(pWheelKeyCommandData)
        this.setState({
          minionLog: JSON.stringify(
            pWheelKeyCommandData.data.return[0],
            null,
            4
          ),
        })
        this.getWheelKeyListAll()
      })
    }
  }

  public onClickModalCall({name, host, status, _this, handleWheelKeyCommand}) {
    console.log(status)
    return (
      <AgentMinionsModal
        name={name}
        host={host}
        status={status}
        targetObject={_this}
        handleWheelKeyCommand={handleWheelKeyCommand}
      />
    )
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
    // const {parentUrl} = this.props
    const {MinionsObject, minionsPageStatus, focusedHost} = this.state
    return (
      <AgentMinionsTable
        minions={_.values(MinionsObject)}
        minionsPageStatus={minionsPageStatus}
        onClickTableRow={this.onClickTableRowCall}
        onClickModal={this.onClickModalCall}
        handleWheelKeyCommand={this.handleWheelKeyCommand}
        focusedHost={focusedHost}
      />
    )
  }

  private renderAgentPageBottom = () => {
    const {minionLog} = this.state
    return <AgentMinionsConsole res={minionLog} />
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

export default AgentMinions
