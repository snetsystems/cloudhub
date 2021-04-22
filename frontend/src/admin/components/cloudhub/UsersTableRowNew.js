import React, {PureComponent} from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import {notify as notifyAction} from 'src/shared/actions/notifications'

import Dropdown from 'src/shared/components/Dropdown'

import {ErrorHandling} from 'src/shared/decorators/errors'
import {notifyCloudHubUserMissingNameAndProvider} from 'src/shared/copy/notifications'
import {USERS_TABLE} from 'src/admin/constants/cloudhubTableSizing'
import {USER_ROLES} from 'src/admin/constants/cloudhubAdmin'

class UsersTableRowNew extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      name: '',
      provider: '',
      scheme: 'oauth2',
      role: this.props.organization.defaultRole,
    }
  }

  handleInputChange = (fieldName) => (e) => {
    this.setState({[fieldName]: e.target.value.trim()})

    if (fieldName === 'provider') {
      if (e.target.value === 'cloudhub') {
        this.setState({scheme: 'basic'})
      } else {
        this.setState({scheme: 'oauth2'})
      }
    }
  }

  handleConfirmCreateUser = () => {
    const {onBlur, onCreateUser, organization} = this.props
    const {name, provider, scheme, role} = this.state

    const newUser = {
      name,
      provider,
      scheme,
      roles: [
        {
          name: role,
          organization: organization.id,
        },
      ],
    }

    onCreateUser(newUser)
    onBlur()
  }

  handleInputFocus = (e) => {
    e.target.select()
  }

  handleSelectProvider = (newProvider) => {
    const {text: provider} = newProvider
    this.setState({provider})
  }

  handleSelectRole = (newRole) => {
    this.setState({role: newRole.text})
  }

  handleKeyDown = (e) => {
    const {name, provider} = this.state
    const preventCreate = !name || !provider

    if (e.key === 'Escape') {
      this.props.onBlur()
    }

    if (e.key === 'Enter') {
      if (preventCreate) {
        return this.props.notify(notifyCloudHubUserMissingNameAndProvider())
      }
      this.handleConfirmCreateUser()
    }
  }

  componentDidUpdate = (_, prevState) => {
    const {provider} = this.state
    if (prevState.provider !== provider) {
      if (provider === 'cloudhub') {
        // eslint-disable-next-line react/no-did-update-set-state
        this.setState({scheme: 'basic'})
      } else {
        // eslint-disable-next-line react/no-did-update-set-state
        this.setState({scheme: 'oauth2'})
      }
    }
  }

  componentDidMount = () => {
    const {providers} = this.props
    if (providers.length > 0) {
      this.setState({provider: providers[0]})
    }
  }

  render() {
    const {colRole, colProvider, colScheme, colActions} = USERS_TABLE
    const {onBlur, providers} = this.props
    const {name, provider, scheme, role} = this.state

    const dropdownRolesItems = USER_ROLES.map((r) => ({...r, text: r.name}))
    const preventCreate = !name || !provider

    return (
      <tr className="cloudhub-admin-table--new-user">
        <td>
          <input
            className="form-control input-xs"
            type="text"
            placeholder="Username..."
            autoFocus={true}
            value={name}
            onChange={this.handleInputChange('name')}
            onKeyDown={this.handleKeyDown}
          />
        </td>
        <td style={{width: colRole}}>
          <Dropdown
            items={dropdownRolesItems}
            selected={role}
            onChoose={this.handleSelectRole}
            buttonColor="btn-primary"
            buttonSize="btn-xs"
            className="dropdown-stretch"
          />
        </td>
        <td style={{width: colProvider}}>
          <Dropdown
            items={providers}
            selected={provider}
            onChoose={this.handleSelectProvider}
            buttonColor="btn-primary"
            buttonSize="btn-xs"
            className="dropdown-stretch"
          />
          {/* <input
            className="form-control input-xs"
            type="text"
            placeholder="cloudhub or OAuth"
            value={provider}
            onChange={this.handleInputChange('provider')}
            onKeyDown={this.handleKeyDown}
          /> */}
        </td>
        <td style={{width: colScheme}}>
          <input
            className="form-control input-xs disabled"
            type="text"
            disabled={true}
            placeholder="OAuth Scheme..."
            value={scheme}
          />
        </td>
        <td className="text-right" style={{width: colActions}}>
          <button className="btn btn-xs btn-square btn-info" onClick={onBlur}>
            <span className="icon remove" />
          </button>
          <button
            className="btn btn-xs btn-square btn-success"
            disabled={preventCreate}
            onClick={this.handleConfirmCreateUser}
          >
            <span className="icon checkmark" />
          </button>
        </td>
      </tr>
    )
  }
}

const {func, shape, string, arrayOf} = PropTypes

UsersTableRowNew.propTypes = {
  organization: shape({
    id: string.isRequired,
    name: string.isRequired,
  }),
  onBlur: func.isRequired,
  onCreateUser: func.isRequired,
  notify: func.isRequired,
  providers: arrayOf(string).isRequired,
}

const mapDispatchToProps = (dispatch) => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(
  null,
  mapDispatchToProps
)(ErrorHandling(UsersTableRowNew))
