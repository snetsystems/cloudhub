import {ShellInfo} from 'src/types'

export type Action =
  | ShellOpenAction
  | ShellCloseAction
  | ShellAddAction
  | ShellRemoveAction
  | ShellUpdateAction

export enum ActionTypes {
  ShellOpen = 'SHELL_OPEN',
  ShellClose = 'SHELL_CLOSE',
  ShellAdd = 'SHELL_ADD',
  ShellRemove = 'SHELL_REMOVE',
  ShellUpdate = 'SHELL_UPDATE',
}

interface ShellOpenAction {
  type: ActionTypes.ShellOpen
  payload?: ShellInfo
}

export const openShell = (shell?: ShellInfo): ShellOpenAction => ({
  type: ActionTypes.ShellOpen,
  payload: shell,
})

interface ShellCloseAction {
  type: ActionTypes.ShellClose
}

export const closeShell = (): ShellCloseAction => ({
  type: ActionTypes.ShellClose,
})

interface ShellAddAction {
  type: ActionTypes.ShellAdd
  payload: ShellInfo
}

export const addShell = (shell: ShellInfo): ShellAddAction => ({
  type: ActionTypes.ShellAdd,
  payload: shell,
})

interface ShellRemoveAction {
  type: ActionTypes.ShellRemove
  payload: ShellInfo['nodename']
}

export const removeShell = (
  nodename: ShellInfo['nodename']
): ShellRemoveAction => ({
  type: ActionTypes.ShellRemove,
  payload: nodename,
})

interface ShellUpdateAction {
  type: ActionTypes.ShellUpdate
  payload: ShellInfo
}

export const updateShell = (shell: ShellInfo): ShellUpdateAction => ({
  type: ActionTypes.ShellUpdate,
  payload: shell,
})
