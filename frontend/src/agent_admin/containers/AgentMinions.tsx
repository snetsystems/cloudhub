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

interface Props {
  onClickTableRow: () => void
  onClickAction: () => void
  onClickModal: () => void
  onClickRun: () => void
  onClickStop: () => void
  onClickInstall: () => void
}
interface State {
  minions: Readonly<[]>
  proportions: number[]
}

class AgentMinions extends PureComponent<State> {
  constructor(props) {
    super(props)
    this.state = {
      minionLog: 'not load log',
      proportions: [0.43, 0.57],
    }
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
    // const {parentUrl} = this.props
    const {currentUrl, minions, onClickTableRow, onClickModal} = this.props
    return (
      <AgentTable
        currentUrl={currentUrl}
        minions={minions}
        onClickTableRow={onClickTableRow}
        onClickModal={onClickModal}
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

export default AgentMinions
