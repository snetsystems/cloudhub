import React, {PureComponent} from 'react'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentTable from 'src/agent_admin/components/AgentTable'
import AgentConsole from 'src/agent_admin/components/AgentConsole'

import {ErrorHandling} from 'src/shared/decorators/errors'

//const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

interface State {
  proportions: Readonly<{}>
  minionLog: ''
  onClickTableRow: () => void
}

@ErrorHandling
class AgentControl extends PureComponent<State> {
  constructor(props) {
    super(props)
    this.state = {
      minionLog: 'not load log',
      proportions: [0.43, 0.57],
    }
  }

  public onClickTableRowCall() {
    return console.log('row Called', this)
  }

  public onClickActionCall() {
    return console.log('action Called', this)
  }

  public onClickRunCall() {
    return console.log('Run Called', this)
  }

  public onClickStopCall() {
    return console.log('Stop Called', this)
  }

  public onClickInstallCall() {
    return console.log('Install Called', this)
  }

  public componentDidMount() {}

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

  private renderAgentPageTop = () => {
    const {currentUrl, minions} = this.props
    return (
      <AgentTable
        currentUrl={currentUrl}
        minions={minions}
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
