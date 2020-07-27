import {Shell} from 'src/types'

export type Action = ShellOpenAction | ShellCloseAction

export enum ActionTypes {
  ShellOpen = 'SHELL_OPEN',
  ShellClose = 'SHELL_CLOSE',
}

interface ShellOpenAction {
  type: ActionTypes.ShellOpen
  payload: Shell
}

export const openShell = (
  address?: string,
  nodename?: string
): ShellOpenAction => ({
  type: ActionTypes.ShellOpen,
  payload: {
    isVisible: true,
    address,
    nodename,
  },
})

interface ShellCloseAction {
  type: ActionTypes.ShellClose
  payload: Shell
}

export const closeShell = (): ShellCloseAction => ({
  type: ActionTypes.ShellClose,
  payload: {
    isVisible: false,
  },
})
