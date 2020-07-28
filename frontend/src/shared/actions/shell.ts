import {ShellLoad} from 'src/types'

export type Action = ShellOpenAction | ShellCloseAction

export enum ActionTypes {
  ShellOpen = 'SHELL_OPEN',
  ShellClose = 'SHELL_CLOSE',
  ShellAdd = 'SHELL_ADD',
  ShellRemove = 'SHELL_REMOVE',
}

interface ShellOpenAction {
  type: ActionTypes.ShellOpen
  payload: ShellLoad
}

export const openShell = (
  address?: string,
  nodename?: string,
  key?: string
): ShellOpenAction => {
  return {
    type: ActionTypes.ShellOpen,
    payload: {
      isVisible: true,
      shell: {
        key,
        address,
        nodename,
      },
    },
  }
}

interface ShellCloseAction {
  type: ActionTypes.ShellClose
  payload: ShellLoad
}

export const closeShell = (): ShellCloseAction => ({
  type: ActionTypes.ShellClose,
  payload: {
    isVisible: false,
  },
})

interface ShellAddAction {
  type: ActionTypes.ShellAdd
  payload: ShellLoad
}

export const addShell = (): ShellAddAction => ({
  type: ActionTypes.ShellAdd,
  payload: {
    // isNewEdit:
  },
})

interface ShellRemoveAction {
  type: ActionTypes.ShellRemove
  payload: ShellLoad
}

export const removeShell = (): ShellRemoveAction => ({
  type: ActionTypes.ShellRemove,
  payload: {},
})
