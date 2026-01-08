import {OpenPanelPayload} from 'src/types/sidePanel'

export enum SidePanelActionTypes {
  OPEN_PANEL = 'OPEN_PANEL',
  CLOSE_PANEL = 'CLOSE_PANEL',
}

export type SidePanelAction = OpenPanelAction | ClosePanelAction

export interface OpenPanelAction {
  type: SidePanelActionTypes.OPEN_PANEL
  payload: {
    isOpen: boolean
    panelProps: React.ReactNode
    width?: number
  }
}

export const openPanel = (payload: OpenPanelPayload): OpenPanelAction => {
  return {
    type: SidePanelActionTypes.OPEN_PANEL,
    payload: {
      isOpen: true,
      panelProps: payload.panelProps,
      width: payload.width,
    },
  }
}

export interface ClosePanelAction {
  type: SidePanelActionTypes.CLOSE_PANEL
}

export const closePanel = (): ClosePanelAction => {
  return {
    type: SidePanelActionTypes.CLOSE_PANEL,
  }
}
