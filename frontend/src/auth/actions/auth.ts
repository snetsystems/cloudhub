import {Dispatch} from 'redux'
import _ from 'lodash'

// Types
import {BasicUser} from 'src/types'

// Action
import {notify} from 'src/shared/actions/notifications'
import {
  notifyLoginFailed,
  notifyUserAddCompleted,
  notifyUserAddFailed,
  notifyUserPasswordResetCompleted,
  notifyUserPasswordResetFailed,
  notifyUserUpdateCompleted,
  notifyUserUpdateFailed,
  notifyUserOTPChangeCompleted,
  notifyUserOTPChangeFailed,
  notifyUserLockChangeSuccess,
  notifyeUserLockChangFailed,
} from 'src/shared/copy/notifications'

// API
import {
  login,
  createUser,
  getUser,
  updateUser,
  passwordReset,
  otpChange,
  changeUserLock,
} from 'src/auth/apis'

export enum ActionTypes {
  UserLoginRequested = 'USER_LOGIN_REQUESTED',
  UserLoginFailed = 'USER_LOGIN_FAILED',
  UserAddRequested = 'USER_ADD_REQUESTED',
  UserAddCompleted = 'USER_ADD_COMPLETED',
  UserAddFailed = 'USER_ADD_FAILED',
  UserGetRequested = 'USER_GET_REQUESTED',
  UserGetCompleted = 'USER_GET_COMPLETED',
  UserGetFailed = 'USER_GET_FAILED',
  UserDeleteRequested = 'USER_DELETE_REQUESTED',
  UserDeleteCompleted = 'USER_DELETE_COMPLETED',
  UserDeleteFailed = 'USER_DELETE_FAILED',
  UserUpdateReqeusted = 'USER_UPDATE_REQUESTED',
  UserUpdateCompleted = 'USER_UPDATE_COMPLETED',
  UserUpdateFailed = 'USER_UPDATE_FAILED',
  UserPasswordResetReqeusted = 'USER_PASSWORD_RESET_REQUESTED',
  UserPasswordResetCompleted = 'USER_PASSWORD_RESET_COMPLETED',
  UserPasswordResetFailed = 'USER_PASSWORD_RESET_FAILED',
  UserOTPChangeRequested = 'USER_OTP_CHANGE_REQUESTED',
  UserOTPChangeCompleted = 'USER_OTP_CHANGE_COMPLETED',
  UserOTPChangeFailed = 'USER_OTP_CHANGE_FAILED',
  UserLockChangeRequested = 'USER_LOCK_CHANGE_REQUESTED',
  UserLockChangeCompleted = 'USER_LOCK_CHANGE_COMPLETED',
  UserLockChangeFailed = 'USER_LOCK_CHANGE_FAILED',
  UserLockChange = 'CLOUDHUB_LOCK_CHANGE_USER',
}

export type Action =
  | UserLoginRequestedAction
  | UserLoginFailedAction
  | UserAddRequestedAction
  | UserAddCompletedAction
  | UserAddFailedAction
  | UserDeleteRequestedAction
  | UserDeleteCompletedAction
  | UserDeleteFailedAction
  | UserUpdateReqeustedAction
  | UserUpdateCompletedAction
  | UserUpdateFailedAction
  | UserPasswordResetReqeustedAction
  | UserPasswordResetCompletedAction
  | UserPasswordResetFailedAction
  | UserOTPChangeRequestedAction
  | UserOTPChangeCompletedAction
  | UserOTPChangeFailedAction
  | UserGetRequestedAction
  | UserGetCompletedAction
  | UserGetFailedAction
  | UserLockChangeAction
export interface UserLoginRequestedAction {
  type: ActionTypes.UserLoginRequested
}

export const userLoginRequested = () => ({type: ActionTypes.UserLoginRequested})

export interface UserLoginFailedAction {
  type: ActionTypes.UserLoginFailed
}

export const userLoginFailed = () => ({type: ActionTypes.UserLoginFailed})

export interface UserAddRequestedAction {
  type: ActionTypes.UserAddRequested
}

export const userAddRequested = () => ({type: ActionTypes.UserAddRequested})

export interface UserAddCompletedAction {
  type: ActionTypes.UserAddCompleted
}

export const userAddCompleted = () => ({type: ActionTypes.UserAddCompleted})

export interface UserAddFailedAction {
  type: ActionTypes.UserAddFailed
}

export const userAddFailed = () => ({type: ActionTypes.UserAddFailed})

export interface UserDeleteRequestedAction {
  type: ActionTypes.UserDeleteRequested
}

export interface UserGetRequestedAction {
  type: ActionTypes.UserGetRequested
}
export const userGetRequested = () => ({
  type: ActionTypes.UserGetRequested,
})
export interface UserGetCompletedAction {
  type: ActionTypes.UserGetCompleted
}
export const userGetCompleted = () => ({
  type: ActionTypes.UserGetCompleted,
})
export interface UserGetFailedAction {
  type: ActionTypes.UserGetFailed
}
export const userGetFailed = () => ({type: ActionTypes.UserGetFailed})

export const userDeleteRequested = () => ({
  type: ActionTypes.UserDeleteRequested,
})
export interface UserDeleteCompletedAction {
  type: ActionTypes.UserDeleteCompleted
}

export const userDeleteCompleted = () => ({
  type: ActionTypes.UserDeleteCompleted,
})
export interface UserDeleteFailedAction {
  type: ActionTypes.UserDeleteFailed
}

export const userDeleteFailed = () => ({type: ActionTypes.UserDeleteFailed})

export interface UserUpdateReqeustedAction {
  type: ActionTypes.UserUpdateReqeusted
}

export const userUpdateReqeusted = () => ({
  type: ActionTypes.UserUpdateReqeusted,
})

export interface UserUpdateCompletedAction {
  type: ActionTypes.UserUpdateCompleted
}

export const userUpdateCompleted = () => ({
  type: ActionTypes.UserUpdateCompleted,
})

export interface UserUpdateFailedAction {
  type: ActionTypes.UserUpdateFailed
}

export const userUpdateFailed = () => ({
  type: ActionTypes.UserUpdateFailed,
})

export interface UserPasswordResetReqeustedAction {
  type: ActionTypes.UserPasswordResetReqeusted
}

export const userPasswordResetReqeusted = () => ({
  type: ActionTypes.UserPasswordResetReqeusted,
})

export interface UserPasswordResetCompletedAction {
  type: ActionTypes.UserPasswordResetCompleted
}

export const userPasswordResetCompleted = () => ({
  type: ActionTypes.UserPasswordResetCompleted,
})

export interface UserPasswordResetFailedAction {
  type: ActionTypes.UserPasswordResetFailed
}

export const userPasswordResetFailed = () => ({
  type: ActionTypes.UserPasswordResetFailed,
})

export interface UserOTPChangeRequestedAction {
  type: ActionTypes.UserOTPChangeRequested
}

export const userOTPChangeRequested = () => ({
  type: ActionTypes.UserOTPChangeRequested,
})

export interface UserOTPChangeCompletedAction {
  type: ActionTypes.UserOTPChangeCompleted
}

export const userOTPChangeCompleted = () => ({
  type: ActionTypes.UserOTPChangeCompleted,
})

export interface UserOTPChangeFailedAction {
  type: ActionTypes.UserOTPChangeFailed
}

export const userOTPChangeFailed = () => ({
  type: ActionTypes.UserOTPChangeFailed,
})

export interface UserLockChangeRequestedAction {
  type: ActionTypes.UserLockChangeRequested
}

export const userLockChangeRequested = () => ({
  type: ActionTypes.UserLockChangeRequested,
})

export interface UserLockChangeCompletedAction {
  type: ActionTypes.UserLockChangeCompleted
}

export const userLockChangeCompleted = () => ({
  type: ActionTypes.UserLockChangeCompleted,
})

export interface UserLockChangeFailedAction {
  type: ActionTypes.UserLockChangeFailed
}

export const userLockChangeFailed = () => ({
  type: ActionTypes.UserLockChangeFailed,
})

export interface UserLockChangeAction {
  type: ActionTypes.UserLockChange
  payload: BasicUser
}

export const userLockChange = (user: BasicUser) => ({
  type: ActionTypes.UserLockChange,
  payload: user,
})

export interface BasicAuth {
  name: string
  password: string
  email?: string
}

export interface RetryPolicy {
  name: string
  policy: string
}

export interface LoginParams {
  url: string
  user: BasicAuth
  retryPolicys: RetryPolicy[]
}

export const loginAsync = ({url, user, retryPolicys}: LoginParams) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userLoginRequested())
  try {
    const res = await login({url, user})
    return res
  } catch (error) {
    let retryPolicysObj = {}

    _.forEach(retryPolicys, r => {
      retryPolicysObj = {
        ...retryPolicysObj,
        [r.name]: r.policy,
      }
    })

    dispatch(userLoginFailed())
    dispatch(notify(notifyLoginFailed(error.data, retryPolicysObj)))

    throw error
  }
}

export interface SignupParams {
  url: string
  user: BasicAuth
}

export const createUserAsync = ({url, user}: SignupParams) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userAddRequested())

  try {
    const res = await createUser({url, user})

    dispatch(userAddCompleted())
    dispatch(notify(notifyUserAddCompleted()))
    return res
  } catch (error) {
    dispatch(userAddFailed())
    dispatch(notify(notifyUserAddFailed(error.data)))

    throw error
  }
}

export interface GetUserParams {
  url: string
}

export const getUserAsync = ({url}: GetUserParams) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userGetRequested())

  try {
    const res = await getUser({url})
    dispatch(userGetCompleted())
    return res
  } catch (error) {
    dispatch(userGetFailed())
    throw error
  }
}

export interface UpdateUserAsync {
  url: string
  user: BasicAuth
}

export const updateUserAsync = ({url, user}: UpdateUserAsync) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userUpdateReqeusted())
  try {
    const res = await updateUser({url, user})
    dispatch(userUpdateCompleted())
    dispatch(notify(notifyUserUpdateCompleted()))
    return res
  } catch (error) {
    dispatch(userUpdateFailed())
    dispatch(notify(notifyUserUpdateFailed()))
    throw error
  }
}

export interface PasswordResetParams {
  url: string
  path: string
  name: string
  passwordReturn?: boolean
}

export interface ResetResponse {
  name: string
  password?: string
  passwordResetFlag: string
  provider: string
  pwrtn: string
  scheme: string
  send_kind: string
}

export const passwordResetAsync = ({
  url,
  path,
  name,
  passwordReturn = false,
}: PasswordResetParams) => async (dispatch: Dispatch<Action>) => {
  dispatch(userPasswordResetReqeusted())
  try {
    const {data} = await passwordReset({
      url,
      path,
      name,
      passwordReturn,
    })

    dispatch(userPasswordResetCompleted())
    dispatch(
      notify(
        notifyUserPasswordResetCompleted({
          name: data.name,
          password: data.password,
          sendKind: data.send_kind,
          passwordReturn,
        })
      )
    )

    return data
  } catch (error) {
    dispatch(userPasswordResetFailed())
    dispatch(notify(notifyUserPasswordResetFailed()))
    throw error
  }
}
export interface OTPChangeParams {
  url: string
  user: BasicAuth
}

export const otpChangeAsync = ({url, user}: OTPChangeParams) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userOTPChangeRequested())
  try {
    const res = await otpChange({url, user})
    dispatch(userOTPChangeCompleted())
    dispatch(notify(notifyUserOTPChangeCompleted()))
    return res
  } catch (error) {
    dispatch(userPasswordResetFailed())
    dispatch(notify(notifyUserOTPChangeFailed()))
    throw error
  }
}

export interface UserLockParams {
  url: string
  user: BasicUser
}

export const changeUserLockAsync = ({
  url,
  user: oldUser,
}: UserLockParams) => async (dispatch: Dispatch<Action>) => {
  dispatch(userLockChangeRequested())
  try {
    const {name, locked} = oldUser
    const user = {
      name,
      locked: !locked,
    }

    const newUser: BasicUser = {
      ...oldUser,
      ...user,
    }

    const res = await changeUserLock({url, user})

    dispatch(userLockChangeCompleted())
    dispatch(userLockChange(newUser))

    dispatch(notify(notifyUserLockChangeSuccess()))
    return res
  } catch (error) {
    dispatch(userLockChangeFailed())
    dispatch(notify(notifyeUserLockChangFailed()))
    throw error
  }
}
