import React, {PureComponent} from 'react'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import * as adminCloudHubActionCreators from 'src/admin/actions/cloudhub'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {ErrorHandling} from 'src/shared/decorators/errors'

import UsersTable from 'src/admin/components/cloudhub/UsersTable'
import {passwordResetAsync} from 'src/auth/actions'

class UsersPage extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      isLoading: true,
    }
  }

  handleCreateUser = user => {
    const {
      links,
      actions: {createUserAsync},
    } = this.props
    createUserAsync(links.users, user)
  }

  handleUpdateUserRole = (user, currentRole, {name}) => {
    const {
      actions: {updateUserAsync},
    } = this.props
    const updatedRole = {...currentRole, name}
    const newRoles = user.roles.map(r =>
      r.organization === currentRole.organization ? updatedRole : r
    )
    updateUserAsync(
      user,
      {...user, roles: newRoles},
      `${user.name} is now a ${name}`
    )
  }

  handleDeleteUser = user => {
    const {
      actions: {deleteUserAsync},
    } = this.props
    deleteUserAsync(user, {isAbsoluteDelete: false})
  }

  handleResetUserPassword = name => {
    const {handleResetPassword} = this.props

    handleResetPassword({
      url: '/cloudhub/v1/password/reset',
      path: '/kapacitor/v1/service-tests/smtp',
      userId: name,
      passwordReturn: true,
    })
  }

  async componentWillMount() {
    const {
      links,
      actions: {loadOrganizationsAsync, loadUsersAsync},
    } = this.props

    this.setState({isLoading: true})

    await Promise.all([
      loadOrganizationsAsync(links.organizations),
      loadUsersAsync(links.users),
    ])

    this.setState({isLoading: false})
  }

  render() {
    const {
      meCurrentOrganization,
      organizations,
      meID,
      users,
      notify,
      handlePasswordReset,
    } = this.props
    const {isLoading} = this.state

    const organization = organizations.find(
      o => o.id === meCurrentOrganization.id
    )

    return (
      <UsersTable
        meID={meID}
        users={users}
        organization={organization}
        onCreateUser={this.handleCreateUser}
        onUpdateUserRole={this.handleUpdateUserRole}
        onDeleteUser={this.handleDeleteUser}
        onResetPassword={this.handlePasswordReset}
        notify={notify}
        isLoading={isLoading}
        onResetUserPassword={this.handleResetUserPassword}
      />
    )
  }
}

const {arrayOf, func, shape, string} = PropTypes

UsersPage.propTypes = {
  links: shape({
    users: string.isRequired,
  }),
  meID: string.isRequired,
  meCurrentOrganization: shape({
    id: string.isRequired,
    name: string.isRequired,
  }).isRequired,
  users: arrayOf(shape),
  organizations: arrayOf(shape),
  actions: shape({
    loadUsersAsync: func.isRequired,
    loadOrganizationsAsync: func.isRequired,
    createUserAsync: func.isRequired,
    updateUserAsync: func.isRequired,
    deleteUserAsync: func.isRequired,
  }),
  notify: func.isRequired,
  handleResetPassword: func,
}

const mapStateToProps = ({links, adminCloudHub: {organizations, users}}) => ({
  links,
  organizations,
  users,
})

const mapDispatchToProps = dispatch => ({
  actions: bindActionCreators(adminCloudHubActionCreators, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
  handleResetPassword: bindActionCreators(passwordResetAsync, dispatch),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ErrorHandling(UsersPage))
