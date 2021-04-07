import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import * as adminCloudHubActionCreators from 'src/admin/actions/cloudhub'
import * as configActionCreators from 'src/shared/actions/config'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {
  passwordResetAsync,
  PasswordResetParams,
  changeUserLockAsync,
  UserLockParams,
} from 'src/auth/actions'
import {ErrorHandling} from 'src/shared/decorators/errors'

import AllUsersTable from 'src/admin/components/cloudhub/AllUsersTable'
import {
  Links,
  Organization,
  Role,
  User,
  Notification,
  NotificationFunc,
  BasicUser,
} from 'src/types'
import {AlertTypes} from 'src/kapacitor/constants'

interface Props {
  providers: string[]
  notify: (message: Notification | NotificationFunc) => void
  links: Links
  meID: string
  users: User[]
  organizations: Organization[]
  actionsAdmin: {
    loadUsersAsync: (link: string) => void
    loadOrganizationsAsync: (link: string) => void
    createUserAsync: (link: string, user: User) => void
    updateUserAsync: (user: User, updatedUser: User, message: string) => void
    deleteUserAsync: (
      user: User,
      deleteObj: {isAbsoluteDelete: boolean}
    ) => void
  }
  actionsConfig: {
    getAuthConfigAsync: (link: string) => void
    updateAuthConfigAsync: () => void
  }
  authConfig: {
    superAdminNewUsers: boolean
  }
  handlePasswordReset: ({
    url,
    path,
    name,
    passwordReturn,
  }: PasswordResetParams) => void

  handleChangeUserLock: ({url, user}: UserLockParams) => void
}

interface State {
  isLoading: boolean
}

@ErrorHandling
export class AllUsersPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      isLoading: true,
    }
  }

  public componentDidMount() {
    const {
      links,
      actionsConfig: {getAuthConfigAsync},
    } = this.props
    getAuthConfigAsync(links.config.auth)
  }

  public async componentWillMount() {
    const {
      links,
      actionsAdmin: {loadOrganizationsAsync, loadUsersAsync},
    } = this.props

    this.setState({isLoading: true})

    await Promise.all([
      loadOrganizationsAsync(links.organizations),
      loadUsersAsync(links.allUsers),
    ])

    this.setState({isLoading: false})
  }

  public handleCreateUser = (user: User) => {
    const {
      links,
      actionsAdmin: {createUserAsync},
    } = this.props
    createUserAsync(links.allUsers, user)
  }

  public handleUpdateUserRoles = (
    user: User,
    roles: Role[],
    successMessage: string
  ) => {
    const {
      actionsAdmin: {updateUserAsync},
    } = this.props
    const updatedUser = {...user, roles}
    updateUserAsync(user, updatedUser, successMessage)
  }

  public handleUpdateUserSuperAdmin = (user: User, superAdmin: boolean) => {
    const {
      actionsAdmin: {updateUserAsync},
    } = this.props
    const updatedUser = {...user, superAdmin}
    updateUserAsync(
      user,
      updatedUser,
      `${user.name}'s SuperAdmin status has been updated`
    )
  }

  public handleDeleteUser = (user: User) => {
    const {
      actionsAdmin: {deleteUserAsync},
    } = this.props
    deleteUserAsync(user, {isAbsoluteDelete: true})
  }

  public render() {
    const {
      meID,
      users,
      links,
      notify,
      authConfig,
      actionsConfig,
      organizations,
      providers,
    } = this.props

    return (
      <AllUsersTable
        meID={meID}
        users={users}
        links={links}
        notify={notify}
        authConfig={authConfig}
        actionsConfig={actionsConfig}
        organizations={organizations}
        providers={providers}
        isLoading={this.state.isLoading}
        onDeleteUser={this.handleDeleteUser}
        onCreateUser={this.handleCreateUser}
        onUpdateUserRoles={this.handleUpdateUserRoles}
        onUpdateUserSuperAdmin={this.handleUpdateUserSuperAdmin}
        onResetPassword={this.onResetPassword}
        onChangeUserLock={this.onChangeUserLock}
      />
    )
  }

  private onResetPassword = (name: string) => {
    const {
      handlePasswordReset,
      links: {basicPasswordAdminReset},
    } = this.props

    handlePasswordReset({
      url: basicPasswordAdminReset,
      path: `/kapacitor/v1/service-tests/${AlertTypes.smtp}`,
      name,
      passwordReturn: true,
    })
  }

  private onChangeUserLock = (user: BasicUser) => {
    const {
      handleChangeUserLock,
      links: {loginLocked},
    } = this.props

    handleChangeUserLock({
      url: loginLocked,
      user,
    })
  }
}

const mapStateToProps = ({
  links,
  adminCloudHub: {organizations, users},
  config: {auth: authConfig},
}) => ({
  authConfig,
  links,
  organizations,
  users,
})

const mapDispatchToProps = dispatch => ({
  actionsAdmin: bindActionCreators(adminCloudHubActionCreators, dispatch),
  actionsConfig: bindActionCreators(configActionCreators, dispatch),
  notify: bindActionCreators(notifyAction, dispatch),
  handlePasswordReset: bindActionCreators(passwordResetAsync, dispatch),
  handleChangeUserLock: bindActionCreators(changeUserLockAsync, dispatch),
})

export default connect(mapStateToProps, mapDispatchToProps)(AllUsersPage)
