// Libraries
import React, { PureComponent } from 'react'
import { connect } from 'react-redux'

// Components
import { Page } from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'
import AgentMinions from 'src/agent_admin/containers/AgentMinions'
import AgentConfiguration from 'src/agent_admin/containers/AgentConfiguration'
import AgentControl from 'src/agent_admin/containers/AgentControl'

// Constants
import {
  isUserAuthorized,
  SUPERADMIN_ROLE,
} from 'src/auth/Authorized'

// Types
import {
  RemoteDataState
} from 'src/types'

interface Props {
  me: {}
  source: { id: number }
  params: { tab: string }
}

class AgentAdminPage extends PureComponent<Props> {
  constructor(props) {
    super(props)

    this.state = {
      hostsPageStatus: RemoteDataState.NotStarted,
      isSelectBoxView: true,
      minions: [],
    }
  }

  public sections = me => {
    return [
      {
        url: 'agent-minions',
        name: 'Minions',
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentMinions
            isUserAuthorized={isUserAuthorized(me.role, SUPERADMIN_ROLE)}
            currentUrl={'agent-minions'}
          />
        ),
      },
      {
        url: 'agent-control',
        name: 'Collector Control',
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentControl
            isUserAuthorized={isUserAuthorized(me.role, SUPERADMIN_ROLE)}
            currentUrl={'agent-control'}
          />
        ),
      },
      {
        url: 'agent-configuration',
        name: 'Collector Config',
        enabled: isUserAuthorized(me.role, SUPERADMIN_ROLE),
        component: (
          <AgentConfiguration
            isUserAuthorized={isUserAuthorized(me.role, SUPERADMIN_ROLE)}
            currentUrl={'agent-configuration'}
          />
        ),
      }
    ]
  }

  render() {
    const {
      me,
      source,
      params: { tab },
    } = this.props
    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Agent Configuration" />
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

const mapStateToProps = ({ auth: { me } }) => ({
  me,
})

export default connect(mapStateToProps, null)(AgentAdminPage)
