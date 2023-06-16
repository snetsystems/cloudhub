export interface Minion {
  host: string
  ip?: string
  os?: string
  osVersion?: string
  status: string
  isRunning?: boolean
  isInstall?: boolean
  isSaveFile?: string
  isAccept?: boolean
  isCheck?: boolean
  isSaltRuning?: boolean
}

export interface MinionsObject {
  [x: string]: Minion
}

export const MinionState = {
  Delete: 'Delete',
  Accept: 'Accept',
  Reject: 'Reject',
  Denied: 'Denied',
  UnAccept: 'UnAccept',
} as const

export type MinionStateType = typeof MinionState[keyof typeof MinionState]
