// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'

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
  me: {}
  source: {id: number}
  params: {tab: string}
}

interface State {
  agentPageStatus: RemoteDataState
  isSelectBoxView: boolean
  minions: []
  userAddress: string
  userId: string
  userPassword: string
  [x: string]: {}
}

const localStorageKey = 'agentPage'
const localStorageObj = 'agentPageState'

class AgentAdminPage extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      agentPageStatus: RemoteDataState.NotStarted,
      isSelectBoxView: true,
      minions: [],
      userAddress: 'http://',
      userId: '',
      userPassword: '',
    }
  }

  componentWillMount() {
    const getLocalStorageItem = this.getLocalStorage({
      localKey: localStorageKey,
      objKey: localStorageObj,
    })
    const thisState = Object.keys(this.state)
    const parseObject = JSON.parse(getLocalStorageItem)[localStorageObj]
    const localState = Object.keys(parseObject)

    thisState.map(s => {
      localState.map(ls => {
        s === ls ? this.setState({[s]: parseObject[ls]}) : null
      })
    })
  }

  componentWillUnmount() {}

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
      },
    ]
  }

  render() {
    const {
      me,
      source,
      params: {tab},
    } = this.props

    const {userAddress, userId, userPassword} = this.state
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
                value={userAddress}
                onChange={this.handleInputChange('userAddress')}
              />
              <input
                className="form-control input-sm agent--input agent--input-id"
                placeholder="Insert Host ID"
                value={userId}
                onChange={this.handleInputChange('userId')}
              />
              <input
                type="password"
                className="form-control input-sm agent--input agent--input-password"
                placeholder="Insert Host Password"
                value={userPassword}
                onChange={this.handleInputChange('userPassword')}
              />
            </div>
          </Page.Header.Right>
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

  private handleInputChange = target => event => {
    this.handleLocalStorage({
      localKey: localStorageKey,
      objKey: localStorageObj,
      target,
      _event: event,
    })

    this.setState({[target]: event.target.value})
  }

  private getLocalStorage = ({localKey, objKey}) => {
    const getItem = localStorage.getItem(localKey)
    if (getItem === null) {
      localStorage.setItem(localKey, JSON.stringify({[objKey]: {}}))
      return localStorage.getItem(localKey)
    } else {
      return getItem
    }
  }

  private setLocalStorage = ({localKey, objKey}) => {
    return localStorage.setItem(localKey, objKey)
  }

  private handleLocalStorage = ({localKey, objKey, target, _event}) => {
    const getLocalStorageItem = this.getLocalStorage({localKey, objKey})
    const getInputData = {[target]: _event.target.value}
    const parseObject = JSON.parse(getLocalStorageItem)
    const parseString = JSON.stringify({
      [objKey]: Object.assign(parseObject[objKey], getInputData),
    })

    this.setLocalStorage({localKey, objKey: parseString})
  }
}

const mapStateToProps = ({auth: {me}}) => ({
  me,
})

export default connect(mapStateToProps, null)(AgentAdminPage)
