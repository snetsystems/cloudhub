export interface ShellInfo {
  isNewEditor?: boolean
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
