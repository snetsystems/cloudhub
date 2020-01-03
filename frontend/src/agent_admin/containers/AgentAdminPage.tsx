// Libraries
import React, {PureComponent, ChangeEvent, MouseEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

// Components
import {Page} from 'src/reusable_ui'
import SubSections from 'src/shared/components/SubSections'
import AgentMinions from 'src/agent_admin/containers/AgentMinions'
import AgentConfiguration from 'src/agent_admin/containers/AgentConfiguration'
import AgentControl from 'src/agent_admin/containers/AgentControl'
import AgentConnectTips from 'src/agent_admin/components/AgentConnectTips'
import AgentConnectForm from 'src/agent_admin/components/AgentConnectForm'

// Notification
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  notifyAgentConnectFailed,
  notifyAgentConnectSucceeded,
  notifyAgentDisconnected,
} from 'src/agent_admin/components/notifications'

// APIs
import {getSaltToken} from 'src/agent_admin/apis'

// Constants
import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

// Types
import {RemoteDataState, Notification, NotificationFunc} from 'src/types'

interface Props {
  notify: (message: Notification | NotificationFunc) => void
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
  isTokenCheck: boolean
  masterUrl: string
  masterId: string
  masterPwd: string
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
      isTokenCheck: true,
      masterUrl: 'http://',
      masterId: '',
      masterPwd: '',
      saltMasterUrl: '',
      saltMasterToken: '',
    }
  }

  componentWillMount() {
    const saltMasterUrl = window.localStorage.getItem('salt-master-url')
    const saltMasterToken = window.localStorage.getItem('salt-master-token')

    if (saltMasterToken !== null) {
      this.setState({
        isTokenCheck: true,
        saltMasterUrl: saltMasterUrl,
        saltMasterToken: saltMasterToken,
      })
    } else {
      this.setState({
        masterUrl: 'http://',
        masterId: '',
        masterPwd: '',
        saltMasterUrl: '',
        saltMasterToken: '',
        isTokenCheck: false,
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
            onLogout={this.handleLogout}
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
            onLogout={this.handleLogout}
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
            onLogout={this.handleLogout}
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

    const {
      isTokenCheck,
      saltMasterUrl,
      masterUrl,
      masterId,
      masterPwd,
    } = this.state

    return (
      <Page>
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Agent Configuration" />
          </Page.Header.Left>
          <Page.Header.Right>
            <AgentConnectForm
              onLoginClick={this.handleLogin}
              onLogoutClick={this.handleLogout}
              onChangeUrl={this.handleChangeMasterUrl}
              onChangeId={this.handleChangeMasterId}
              onChangePwd={this.handleChangeMasterPwd}
              masterUrl={masterUrl}
              masterId={masterId}
              masterPwd={masterPwd}
              isTokenCheck={isTokenCheck}
            />
            <AgentConnectTips saltMasterUrl={saltMasterUrl} />
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

  handleLogin = (e: LoginEvent) => {
    if (e.nativeEvent.which === 13 || e.nativeEvent.which === 1) {
      const {notify} = this.props
      const {masterUrl, masterId, masterPwd} = this.state

      window.localStorage.removeItem('salt-master-url')
      window.localStorage.removeItem('salt-master-token')

      window.localStorage.setItem('salt-master-url', masterUrl)

      const resSaltToken = getSaltToken(masterId, masterPwd)

      resSaltToken.then(pResSaltTokenData => {
        if (
          pResSaltTokenData.message !== undefined &&
          pResSaltTokenData.message !== null
        ) {
          notify(notifyAgentConnectFailed(pResSaltTokenData.message))
        } else {
          window.localStorage.setItem(
            'salt-master-token',
            pResSaltTokenData.data.return[0].token
          )
          this.setState({
            saltMasterUrl: masterUrl,
            saltMasterToken: pResSaltTokenData.data.return[0].token,
            isTokenCheck: true,
          })
          notify(notifyAgentConnectSucceeded(masterUrl))
        }
      })
    }
  }

  handleLogout = () => {
    const {notify} = this.props

    window.localStorage.removeItem('salt-master-url')
    window.localStorage.removeItem('salt-master-token')

    this.setState({
      masterUrl: 'http://',
      masterId: '',
      masterPwd: '',
      saltMasterUrl: '',
      saltMasterToken: '',
      isTokenCheck: false,
    })
    notify(notifyAgentDisconnected())
  }

  public handleChangeMasterUrl = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({masterUrl: e.target.value})
  }

  public handleChangeMasterId = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({masterId: e.target.value})
  }

  public handleChangeMasterPwd = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({masterPwd: e.target.value})
  }
}

const mapStateToProps = ({auth: {me}}) => {
  const meRole = _.get(me, 'role', null)
  return {
    meRole,
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
