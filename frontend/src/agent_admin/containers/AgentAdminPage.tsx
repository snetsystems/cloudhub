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

// Actions
import {getMinionKeyListAllAsyncAdmin} from 'src/agent_admin/actions'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Constants
import {isUserAuthorized, ADMIN_ROLE} from 'src/auth/Authorized'

// Types
import {
  Source,
  RemoteDataState,
  Notification,
  NotificationFunc,
} from 'src/types'
import {Addon} from 'src/types/auth'
import {AddonType} from 'src/shared/constants'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'
import {MinionsObject} from 'src/agent_admin/type'

interface Props {
  source: Source
  notify: (message: Notification | NotificationFunc) => void
  handleGetMinionKeyListAll: (
    saltMasterUrl: string,
    saltMasterToken: string,
    source: Source,
    meRole: string
  ) => Promise<MinionsObject>
  meRole: string
  params: {tab: string}
  handleKeyDown: () => void
  addons: Addon[]
}

interface State {
  agentPageStatus: RemoteDataState
  minionsStatus: RemoteDataState
  isSelectBoxView: boolean
  minionsObject: MinionsObject
  saltMasterUrl: string
  saltMasterToken: string
}

export interface LoginEvent extends MouseEvent<KeyboardEvent> {
  onClick?: React.MouseEvent<HTMLButtonElement, MouseEvent>
  onKeydown?: React.KeyboardEvent<HTMLInputElement>
}

@ErrorHandling
class AgentAdminPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      agentPageStatus: RemoteDataState.NotStarted,
      minionsStatus: RemoteDataState.NotStarted,
      isSelectBoxView: true,
      minionsObject: {},
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

    this.setState({
      saltMasterUrl: saltMasterUrl,
      saltMasterToken: saltMasterToken,
    })

    this.getMinionKeyListAll()
  }

  componentDidMount() {
    //console.log('componentDidMount', this.getMinions())
    //this.setState({minionsObject: this.getMinions()})
  }

  getMinionKeyListAll = async () => {
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    this.setState({minionsStatus: RemoteDataState.Loading})

    //const hosts = await getAllHosts(this.props.source)

    const minionListObject = await this.props.handleGetMinionKeyListAll(
      saltMasterUrl,
      saltMasterToken,
      this.props.source,
      this.props.meRole
    )

    this.setState({
      minionsObject: minionListObject,
      minionsStatus: RemoteDataState.Done,
    })
  }

  public sections = (meRole: string) => {
    const {saltMasterUrl, saltMasterToken} = this.state

    return [
      {
        url: 'agent-minions',
        name: 'Minions',
        enabled: isUserAuthorized(meRole, ADMIN_ROLE),
        component: (
          <AgentMinions
            isUserAuthorized={isUserAuthorized(meRole, ADMIN_ROLE)}
            currentUrl={'agent-minions'}
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
            minionsObject={this.state.minionsObject}
            minionsStatus={this.state.minionsStatus}
            handleGetMinionKeyListAll={this.getMinionKeyListAll}
          />
        ),
      },
      {
        url: 'agent-control',
        name: 'Collector Control',
        enabled: isUserAuthorized(meRole, ADMIN_ROLE),
        component: (
          <AgentControl
            isUserAuthorized={isUserAuthorized(meRole, ADMIN_ROLE)}
            currentUrl={'agent-control'}
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
            minionsObject={this.state.minionsObject}
            minionsStatus={this.state.minionsStatus}
            handleGetMinionKeyListAll={this.getMinionKeyListAll}
          />
        ),
      },
      {
        url: 'agent-configuration',
        name: 'Collector Config',
        enabled: isUserAuthorized(meRole, ADMIN_ROLE),
        component: (
          <AgentConfiguration
            isUserAuthorized={isUserAuthorized(meRole, ADMIN_ROLE)}
            currentUrl={'agent-configuration'}
            saltMasterUrl={saltMasterUrl}
            saltMasterToken={saltMasterToken}
            minionsObject={this.state.minionsObject}
            minionsStatus={this.state.minionsStatus}
            handleGetMinionKeyListAll={this.getMinionKeyListAll}
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
  handleGetMinionKeyListAll: getMinionKeyListAllAsyncAdmin,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null
)(AgentAdminPage)
