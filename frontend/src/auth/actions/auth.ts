import {Dispatch} from 'redux'
import _ from 'lodash'

// Notification Action
import {notify} from 'src/shared/actions/notifications'
import {
  notifyLoginFailed,
  notifyUserAddCompleted,
  notifyUserAddFailed,
  notifyUserPasswordResetCompleted,
  notifyUserPasswordResetFailed,
  notifyUserPasswordUpdateCompleted,
  notifyUserPasswordUpdateFailed,
} from 'src/shared/copy/notifications'

// API
import {login, createUser, passwordChange, passwordReset} from 'src/auth/apis'

export enum ActionTypes {
  UserLoginRequested = 'USER_LOGIN_REQUESTED',
  UserLoginFailed = 'USER_LOGIN_FAILED',
  UserAddRequested = 'USER_ADD_REQUESTED',
  UserAddCompleted = 'USER_ADD_COMPLETED',
  UserAddFailed = 'USER_ADD_FAILED',
  UserPasswordUpdateReqeusted = 'USER_PASSWORD_UPDATE_REQUESTED',
  UserPasswordUpdateCompleted = 'USER_PASSWORD_UPDATE_COMPLETED',
  UserPasswordUpdateFailed = 'USER_PASSWORD_UPDATE_FAILED',
  UserPasswordResetReqeusted = 'USER_PASSWORD_RESET_REQUESTED',
  UserPasswordResetCompleted = 'USER_PASSWORD_RESET_COMPLETED',
  UserPasswordResetFailed = 'USER_PASSWORD_RESET_FAILED',
}

export type Action =
  | UserLoginRequestedAction
  | UserLoginFailedAction
  | UserAddRequestedAction
  | UserAddCompletedAction
  | UserAddFailedAction
  | UserPasswordUpdateReqeustedAction
  | UserPasswordUpdateCompletedAction
  | UserPasswordUpdateFailedAction
  | UserPasswordResetReqeustedAction
  | UserPasswordResetCompletedAction
  | UserPasswordResetFailedAction

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

export interface UserPasswordUpdateReqeustedAction {
  type: ActionTypes.UserPasswordUpdateReqeusted
}

export const userPasswordUpdateReqeusted = () => ({
  type: ActionTypes.UserPasswordUpdateReqeusted,
})

export interface UserPasswordUpdateCompletedAction {
  type: ActionTypes.UserPasswordUpdateCompleted
}

export const userPasswordUpdateCompleted = () => ({
  type: ActionTypes.UserPasswordUpdateCompleted,
})

export interface UserPasswordUpdateFailedAction {
  type: ActionTypes.UserPasswordUpdateFailed
}

export const userPasswordUpdateFailed = () => ({
  type: ActionTypes.UserPasswordUpdateFailed,
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

export const loginAsync = ({url, user}) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userLoginRequested())
  try {
    await login({url, user})
  } catch (error) {
    dispatch(userLoginFailed())
    dispatch(notify(notifyLoginFailed()))
  }
}

export const createUserAsync = ({url, user}) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userAddRequested())

  try {
    await createUser({url, user})
    dispatch(userAddCompleted())
    dispatch(notify(notifyUserAddCompleted()))
  } catch (error) {
    dispatch(userAddFailed())
    dispatch(notify(notifyUserAddFailed()))
  }
}

export const passwordChangeAsync = ({url, user}) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userPasswordUpdateReqeusted())
  try {
    await passwordChange({url, user})
    dispatch(userPasswordUpdateCompleted())
    dispatch(notify(notifyUserPasswordUpdateCompleted()))
  } catch (error) {
    dispatch(userPasswordUpdateFailed())
    dispatch(notify(notifyUserPasswordUpdateFailed()))
  }
}

export const passwordResetAsync = ({url, user}) => async (
  dispatch: Dispatch<Action>
) => {
  dispatch(userPasswordResetReqeusted())
  try {
    await passwordReset({url, user})
    dispatch(userPasswordResetCompleted())
    dispatch(notify(notifyUserPasswordResetCompleted()))
  } catch (error) {
    dispatch(userPasswordResetFailed())
    dispatch(notify(notifyUserPasswordResetFailed()))
  }
}
