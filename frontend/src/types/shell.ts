export interface ShellInfo {
  key?: string
  address?: string
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
