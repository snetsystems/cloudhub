export interface ShellInfo {
  isNewEditor?: boolean
  isConn?: boolean
  addr?: string
  nodename?: string
  preNodename?: string
  tabkey?: number
  socket?: any
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
