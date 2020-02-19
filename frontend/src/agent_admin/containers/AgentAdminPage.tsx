// Libraries
import React, {PureComponent, MouseEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

// Components
import {Page} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'
import AgentMinions from 'src/agent_admin/containers/AgentMinions'
import AgentConfiguration from 'src/agent_admin/containers/AgentConfiguration'
import AgentControl from 'src/agent_admin/containers/AgentControl'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Constants
import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

// Types
import {RemoteDataState, Notification, NotificationFunc} from 'src/types'

import {Addon} from 'src/types/auth'
import {AddonType} from 'src/shared/constants'

interface Props {
  notify: (message: Notification | NotificationFunc) => void
  meRole: string
  source: {id: number}
  params: {tab: string}
  handleKeyDown: () => void
  addons: Addon[]
}

interface State {
  agentPageStatus: RemoteDataState
  isSelectBoxView: boolean
  minions: []
  [x: string]: {}
  saltMasterUrl: string
  saltMasterToken: string
}

export interface LoginEvent extends MouseEvent<KeyboardEvent> {
  onClick?: React.MouseEvent<HTMLButtonElement, MouseEvent>
  onKeydown?: React.KeyboardEvent<HTMLInputElement>
}

class AgentAdminPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      agentPageStatus: RemoteDataState.NotStarted,
      isSelectBoxView: true,
      minions: [],
      saltMasterUrl: '',
      saltMasterToken: '',
    }
  }

  componentWillMount() {
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    if (saltMasterToken !== null) {
      this.setState({
        saltMasterUrl: saltMasterUrl,
        saltMasterToken: saltMasterToken,
      })
    }
  }

  public sections = (meRole: string) => {
    const {saltMasterUrl, saltMasterToken} = this.state

    return [
      {
        url: 'agent-minions',
        name: 'Minions',
        enabled: isUserAuthorized(meRole, SUPERADMIN_ROLE),
        component: (
          <AgentMinions
            isUserAuthorized={isUserAuthorized(meRole, SUPERADMIN_ROLE)}
            currentUrl={'agent-minions'}
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
          />
        ),
      },
      {
        url: 'agent-control',
        name: 'Collector Control',
        enabled: isUserAuthorized(meRole, SUPERADMIN_ROLE),
        component: (
          <AgentControl
            isUserAuthorized={isUserAuthorized(meRole, SUPERADMIN_ROLE)}
            currentUrl={'agent-control'}
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
          />
        ),
      },
      {
        url: 'agent-configuration',
        name: 'Collector Config',
        enabled: isUserAuthorized(meRole, SUPERADMIN_ROLE),
        component: (
          <AgentConfiguration
            isUserAuthorized={isUserAuthorized(meRole, SUPERADMIN_ROLE)}
            currentUrl={'agent-configuration'}
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
          />
        ),
      },
    ]
  }

  render() {
    const {
      meRole,
      source,
      params: {tab},
    } = this.props

    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Agent Configuration" />
          </Page.Header.Left>
          <Page.Header.Right></Page.Header.Right>
        </Page.Header>
        <Page.Contents fullWidth={true}>
          <div className="container-fluid full-height agent-page">
            <SubSections
              sections={this.sections(meRole)}
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

const mapStateToProps = ({auth: {me}, links: {addons}}) => {
  const meRole = _.get(me, 'role', null)
  return {
    meRole,
    addons,
  }
}

const mapDispatchToProps = {
  notify: notifyAction,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(AgentAdminPage)
