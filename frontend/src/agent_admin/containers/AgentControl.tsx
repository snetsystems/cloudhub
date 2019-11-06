import React, {PureComponent} from 'react'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentTable from 'src/agent_admin/components/AgentTable'
import AgentConsole from 'src/agent_admin/components/AgentConsole'

import * as adminCMPActionCreators from 'src/admin/actions/cmp'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {ErrorHandling} from 'src/shared/decorators/errors'

//const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

interface State {
  minions: []
  proportions: Readonly<{}>
  minionLog: ''
  onClickTableRow: () => void
}

@ErrorHandling
class AgentControl extends PureComponent<State> {
  constructor(props) {
    super(props)
    this.state = {
      minions: [],
      minionLog: 'not load log',
      proportions: [0.43, 0.57],
    }
  }

  public componentDidMount() {
    this.setState({
      minions: [
        {
          name: 'minion1',
          os: 'ubuntu',
          ip: '192.168.0.1',
          host: 'host1',
          status: 'accepted',
          isRunning: true,
          isInstall: false,
          isSaveFile: false,
          isAccept: true,
        },
        {
          name: 'minion2',
          os: 'debian',
          ip: '192.168.0.2',
          host: 'host2',
          status: 'accepted',
          isRunning: true,
          isInstall: true,
          isSaveFile: true,
          isAccept: true,
        },
        {
          name: 'minion3',
          os: 'window',
          ip: '192.168.0.3',
          host: 'host3',
          isRunning: false,
          isInstall: true,
          isSaveFile: true,
          isAccept: true,
        },
        {
          name: 'minion4',
          os: 'redhat',
          ip: '',
          host: '',
          isRunning: false,
          isInstall: false,
          isSaveFile: false,
          isAccept: false,
        },
        {
          name: 'minion5',
          os: 'mac',
          ip: '',
          host: '',
          isRunning: false,
          isInstall: false,
          isSaveFile: false,
          isAccept: false,
        },
      ],
    })
  }

  render() {
    return (
      <div className="panel panel-solid">
        <Threesizer
          orientation={HANDLE_HORIZONTAL}
          divisions={this.horizontalDivisions}
          onResize={this.handleResize}
        />
      </div>
    )
  }

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
  }

  private renderAgentTable = () => {
    const {
      currentUrl,
      minions,
      onClickTableRow,
      onClickAction,
      onClickModal,
      onClickRun,
      onClickStop,
      onClickInstall,
    } = this.props
    return (
      <AgentTable
        currentUrl={currentUrl}
        minions={minions}
        onClickTableRow={onClickTableRow}
        onClickAction={onClickAction}
        onClickRun={onClickRun}
        onClickStop={onClickStop}
        onClickInstall={onClickInstall}
      />
    )
  }

  private onClickModalCall() {
    return console.log('modal called')
  }

  private onClickActionCall() {
    return console.log('action called', this)
  }

  private onClickRunCall() {
    return console.log('Action Run')
  }

  private onClickStopCall() {
    return console.log('Action Stop')
  }

  private onClickInstallCall() {
    return console.log('Action Install')
  }

  private renderAgentConsole = () => {
    const {minionLog} = this.state
    return <AgentConsole res={minionLog} />
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
        render: this.renderAgentTable,
        headerOrientation: HANDLE_HORIZONTAL,
        size: topSize,
      },
      {
        name: '',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: this.renderAgentConsole,
        headerOrientation: HANDLE_HORIZONTAL,
        size: bottomSize,
      },
    ]
  }
}

export default AgentControl
