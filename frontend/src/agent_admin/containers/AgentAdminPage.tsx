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
    }
  }

  public sections = me => [
    {
      url: 'agent-minions',
      name: 'Minions',
      enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
      component: <AgentMinions />,
    },
    {
      url: 'agent-control',
      name: 'Collector Control',
      enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
      component: <AgentControl />,
    },
    {
      url: 'agent-configuration',
      name: 'Collector Config',
      enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
      component: <AgentConfiguration />,
    },
    {
      url: 'agent-log',
      name: 'Log',
      enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
      component: <AgentLog />,
    },
  ]

  public async componentDidMount() {}

  render() {
    const {
      me,
      source,
      params: {tab},
    } = this.props
    console.log({...this.props})
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
