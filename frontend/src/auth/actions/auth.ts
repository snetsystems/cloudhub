import {Dispatch} from 'redux'
import _ from 'lodash'

// Action
import {notify} from 'src/shared/actions/notifications'
import {
  notifyLoginFailed,
  notifyUserAddCompleted,
  notifyUserAddFailed,
  notifyUserDeleteCompleted,
  notifyUserDeleteFailed,
  notifyUserPasswordResetCompleted,
  notifyUserPasswordResetFailed,
  notifyUserUpdateCompleted,
  notifyUserUpdateFailed,
  notifyUserOTPChangeCompleted,
  notifyUserOTPChangeFailed,
} from 'src/shared/copy/notifications'
import {errorThrown} from 'src/shared/actions/errors'

// API
import {
  login,
  createUser,
  getUser,
  deleteUser,
  updateUser,
  passwordReset,
  otpChange,
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

export interface AuthUser {
  id: string
  password: string
  email?: string
}

export interface LoginParams {
  url: string
  user: AuthUser
}

export const loginAsync = ({url, user}: LoginParams) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userLoginRequested())
  try {
    const res = await login({url, user})
    return res
  } catch (error) {
    dispatch(userLoginFailed())
    dispatch(errorThrown(error, notifyLoginFailed(error.data.message)))
    throw error
  }
}

export interface SignupParams {
  url: string
  user: AuthUser
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
    dispatch(notify(notifyUserAddFailed()))
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
  }
}

export const deleteUserAsync = ({url, user}: SignupParams) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userDeleteRequested())

  try {
    const res = await deleteUser({url, user})
    dispatch(userDeleteCompleted())
    dispatch(notify(notifyUserDeleteCompleted()))
    return res
  } catch (error) {
    dispatch(userDeleteFailed())
    dispatch(notify(notifyUserDeleteFailed()))
  }
}

export interface UpdateUserAsync {
  url: string
  user: AuthUser
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
  }
}

export interface PasswordResetParams {
  url: string
  userId: string
  passwordReturn: boolean
}

export const passwordResetAsync = ({
  url,
  userId,
  passwordReturn,
}: PasswordResetParams) => async (dispatch: Dispatch<Action>) => {
  dispatch(userPasswordResetReqeusted())
  try {
    const res = await passwordReset({url, userId, passwordReturn})
    dispatch(userPasswordResetCompleted())
    dispatch(notify(notifyUserPasswordResetCompleted()))
    return res
  } catch (error) {
    dispatch(userPasswordResetFailed())
    dispatch(notify(notifyUserPasswordResetFailed()))
  }
}
export interface OTPChangeParams {
  url: string
  user: {
    id: string
    password: string
  }
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
  }
}
