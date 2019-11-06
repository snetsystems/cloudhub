import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

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
  minions: Readonly<[]>
  proportions: number[]
}

class AgentConfiguration extends PureComponent<State> {
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
      onClickSave,
      onClickTest,
      onClickApply,
    } = this.props
    return (
      <AgentTable
        currentUrl={currentUrl}
        minions={minions}
        onClickTableRow={onClickTableRow}
        onClickAction={onClickAction}
        onClickSave={onClickSave}
        onClickTest={onClickTest}
        onClickApply={onClickApply}
      />
    )
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

export default AgentConfiguration
