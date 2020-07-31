export interface ShellInfo {
  isNewEditor?: boolean
  addr?: string
  nodename?: string
  socket?: any
  termRef?: object
}

export interface ShellLoad {
  isVisible?: boolean
  shell?: ShellInfo
}

export interface Shells {
  isVisible?: boolean
  tabIndex?: number
  shells: ShellInfo[]
}
