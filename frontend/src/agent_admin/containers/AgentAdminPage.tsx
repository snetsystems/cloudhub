import React, {PureComponent} from 'react'
import {connect} from 'react-redux'

import {Page} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'

import AgentMinions from 'src/agent_admin/containers/AgentMinions'
import AgentConfiguration from 'src/agent_admin/containers/AgentConfiguration'
import AgentControl from 'src/agent_admin/containers/AgentControl'
import AgentLog from 'src/agent_admin/containers/AgentLog'

import {
  isUserAuthorized,
  ADMIN_ROLE,
  SUPERADMIN_ROLE,
} from 'src/auth/Authorized'

// Types
import {
  Source,
  Links,
  NotificationAction,
  RemoteDataState,
  Host,
  Layout,
  TimeRange,
} from 'src/types'

interface AgentAdminPage {}

interface Props {
  me: {}
  source: {}
  params: {}
}

class AgentAdminPage extends PureComponent<Props> {
  constructor(props) {
    super(props)

    this.state = {
      hostsPageStatus: RemoteDataState.NotStarted,
      minion: [],
      isSelectBoxView: true,
    }
  }

  public onClickTableRowCall() {
    return console.log('row Called', this)
  }
  public onClickModalCall() {
    return console.log('modal Called', event, this)
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

  public onClickSaveCall() {
    return console.log('Save Called', this)
  }

  public onClickTestCall() {
    return console.log('Test Called', this)
  }

  public onClickApplyCall() {
    return console.log('Apply Called', this)
  }

  /*
  받아야할 정보
  select의 위치정보(x, y)
  select의 크기정보(w,h)
  window의 리사이즈시 반응하게 할 것인지?
  */

  public onChooseKey() {}

  public Selectkey = () => {
    return <div> Hello </div>
  }

  public sections = me => {
    const {minions} = this.state
    return [
      {
        url: 'agent-minions',
        name: 'Minions',
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentMinions
            currentUrl={'agent-minions'}
            minions={minions}
            onClickTableRow={this.onClickTableRowCall}
            onClickModal={this.onClickModalCall}
          />
        ),
      },
      {
        url: 'agent-control',
        name: 'Collector Control',
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentControl
            currentUrl={'agent-control'}
            minions={minions}
            onClickTableRow={this.onClickTableRowCall}
            onClickAction={this.onClickActionCall}
            onClickRun={this.onClickRunCall}
            onClickStop={this.onClickStopCall}
            onClickInstall={this.onClickInstallCall}
          />
        ),
      },
      {
        url: 'agent-configuration',
        name: 'Collector Config',
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentConfiguration
            currentUrl={'agent-configuration'}
            minions={minions}
            onClickTableRow={this.onClickTableRowCall}
            onClickAction={this.onClickActionCall}
            onClickSave={this.onClickSaveCall}
            onClickTest={this.onClickTestCall}
            onClickApply={this.onClickApplyCall}
          />
        ),
      },
      {
        url: 'agent-log',
        name: 'Log',
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentLog
            currentUrl={'agent-log'}
            minions={minions}
            onClickTableRow={this.onClickTableRowCall}
            onClickAction={this.onClickActionCall}
          />
        ),
      },
    ]
  }

  public componentWillMount() {
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
    const {
      me,
      source,
      params: {tab},
    } = this.props
    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Agent Admin" />
          </Page.Header.Left>
          <Page.Header.Right />
        </Page.Header>
        <Page.Contents fullWidth={true}>
          <div className="container-fluid full-height">
            <SubSections
              sections={this.sections(me)}
              activeSection={tab}
              parentUrl="agent-admin"
              sourceID={source.id}
            />
          </div>
        </Page.Contents>
      </Page>
    )
  }
}

const mapStateToProps = ({auth: {me}}) => ({
  me,
})

export default connect(mapStateToProps, null)(AgentAdminPage)
