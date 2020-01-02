// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

// Components
import {Page} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'
import AgentMinions from 'src/agent_admin/containers/AgentMinions'
import AgentConfiguration from 'src/agent_admin/containers/AgentConfiguration'
import AgentControl from 'src/agent_admin/containers/AgentControl'

// Constants
import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

// Types
import {RemoteDataState} from 'src/types'

interface Props {
  meRole: string
  source: {id: number}
  params: {tab: string}
  handleKeyDown: () => void
}

interface State {
  agentPageStatus: RemoteDataState
  isSelectBoxView: boolean
  minions: []
  [x: string]: {}
}

class AgentAdminPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      agentPageStatus: RemoteDataState.NotStarted,
      isSelectBoxView: true,
      minions: [],
    }
  }

  public sections = (meRole: string) => {
    return [
      {
        url: 'agent-minions',
        name: 'Minions',
        enabled: isUserAuthorized(meRole, SUPERADMIN_ROLE),
        component: (
          <AgentMinions
            isUserAuthorized={isUserAuthorized(meRole, SUPERADMIN_ROLE)}
            currentUrl={'agent-minions'}
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
          <Page.Header.Right>
            <div className="agent-input--container">
              <input
                type="url"
                className="form-control input-sm agent--input agent--input-address"
                // value={masterAddress}
                // onChange={this.handleUpdateMasterAddress}
                onChange={this.props.handleKeyDown}
                // onChange={this.handleInputChange('userAddress')}
              />
              <input
                className="form-control input-sm agent--input agent--input-id"
                placeholder="Insert Host ID"
                // value={masterId}
                readOnly
                // onChange={this.handleInputChange('userId')}
              />
              <input
                type="password"
                className="form-control input-sm agent--input agent--input-password"
                placeholder="Insert Host Password"
                // value={masterPassword}
                readOnly
                // onChange={this.handleInputChange('userPassword')}
              />
            </div>
          </Page.Header.Right>
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

const mapStateToProps = ({auth: {me}}) => {
  const meRole = _.get(me, 'role', null)
  return {
    meRole,
  }
}

export default connect(mapStateToProps, null)(AgentAdminPage)
