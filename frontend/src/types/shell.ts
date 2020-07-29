export interface ShellInfo {
  isNewEditor?: boolean
  addr?: string
  nodename?: string
}

export interface ShellLoad {
  isVisible?: boolean
  shell?: ShellInfo
}

export interface Shells {
  isVisible?: boolean
  shells: ShellInfo[]
}
