export interface ShellInfo {
  isNewEditor?: boolean
  isConn?: boolean
  addr?: string
  nodename?: string
  preNodename?: string
  tabkey?: number
  socket?: any
  //TODO: ssh auth info hide
  sshId?: string
  sshPw?: string
  port?: string
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
