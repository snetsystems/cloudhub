export enum AiAgentsDrawerActionTypes {
  TOGGLE = 'AI_AGENTS_DRAWER_TOGGLE',
  OPEN = 'AI_AGENTS_DRAWER_OPEN',
}

export interface ToggleAiAgentsDrawerAction {
  type: AiAgentsDrawerActionTypes.TOGGLE
}

export interface OpenAiAgentsDrawerAction {
  type: AiAgentsDrawerActionTypes.OPEN
}

export type AiAgentsDrawerAction =
  | ToggleAiAgentsDrawerAction
  | OpenAiAgentsDrawerAction

export const toggleAiAgentsDrawer = (): ToggleAiAgentsDrawerAction => ({
  type: AiAgentsDrawerActionTypes.TOGGLE,
})

/**
 * Reveal the chat without the risk of closing it.
 * Sending context to AI Chat has to open the drawer, and a toggle would hide
 * it whenever it happened to be open already.
 */
export const openAiAgentsDrawer = (): OpenAiAgentsDrawerAction => ({
  type: AiAgentsDrawerActionTypes.OPEN,
})
