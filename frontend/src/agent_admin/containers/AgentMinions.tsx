import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import AgentMinionsTable from 'src/agent_admin/components/AgentMinionsTable'
import AgentConsole from 'src/agent_admin/components/AgentConsole'

import * as adminCMPActionCreators from 'src/admin/actions/cmp'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {ErrorHandling} from 'src/shared/decorators/errors'

import DummyLog from 'src/agent_admin/test/DummyLog'

//const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

interface State {
  minions: Readonly<[]>
  proportions: number[]
}

class AgentMinions extends PureComponent<State> {
  constructor(props) {
    super(props)
    this.state = {
      minions: [
        {
          name: 'minion1',
          os: 'ubuntu',
          ip: '192.168.0.1',
          host: 'host1',
          status: 'accepted',
        },
        {
          name: 'minion2',
          os: 'debian',
          ip: '192.168.0.2',
          host: 'host2',
          status: 'accepted',
        },
        {
          name: 'minion3',
          os: 'window',
          ip: '192.168.0.3',
          host: 'host3',
          status: 'accepted',
        },
        {name: 'minion4', os: 'redhat', ip: '', host: '', status: 'unaccept'},
        {name: 'minion5', os: 'mac', ip: '', host: '', status: 'unaccept'},
      ],
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

    const {minions} = this.state
    console.log('this.props: ', this.props)
    return <AgentMinionsTable minions={minions} />
  }

  private renderAgentConsole = () => {
    return <AgentConsole res={<DummyLog />} />
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

const mapStateToProps = ({links, adminCMP: {organizations, users}}) => ({
  links,
  organizations,
  users,
})

const mapDispatchToProps = dispatch => ({
  actions: bindActionCreators(adminCMPActionCreators, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mapStateToProps, mapDispatchToProps)(
  ErrorHandling(AgentMinions)
)
