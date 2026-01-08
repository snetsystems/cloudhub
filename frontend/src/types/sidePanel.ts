export interface SidePanelState {
  isOpen: boolean
  panelProps: any
  width: number
}

export interface OpenPanelPayload {
  panelProps?: React.ReactNode
  width?: number
}
