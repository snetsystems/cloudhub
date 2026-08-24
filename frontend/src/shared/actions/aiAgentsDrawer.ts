export enum AiAgentsDrawerActionTypes {
  TOGGLE = 'AI_AGENTS_DRAWER_TOGGLE',
}

export interface ToggleAiAgentsDrawerAction {
  type: AiAgentsDrawerActionTypes.TOGGLE
}

export type AiAgentsDrawerAction = ToggleAiAgentsDrawerAction

export const toggleAiAgentsDrawer = (): ToggleAiAgentsDrawerAction => ({
  type: AiAgentsDrawerActionTypes.TOGGLE,
})
