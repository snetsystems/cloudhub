export interface KubernetesItem {
  name: string
  label: string
  type: string
  value?: number
  cpu?: number
  memory?: number
  children?: KubernetesItem[]
  owner?: string
}

export interface FocuseNode {
  name: string
  label: string
}

export interface TooltipPosition {
  top: number
  right: number
  left: number
}

export interface TooltipNode {
  name: string
  cpu: number
  memory: number
}
