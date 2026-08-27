import uuid from 'uuid'

import {AiChatIntent} from 'src/types/aiChatContext'

export enum AiChatContextActionTypes {
  SEND = 'AI_CHAT_CONTEXT_SEND',
  CONSUME = 'AI_CHAT_CONTEXT_CONSUME',
  DETACH = 'AI_CHAT_CONTEXT_DETACH',
  CLEAR = 'AI_CHAT_CONTEXT_CLEAR',
}

export interface SendToAiChatAction {
  type: AiChatContextActionTypes.SEND
  payload: AiChatIntent & {intentId: string}
}

export interface ConsumeAiChatIntentAction {
  type: AiChatContextActionTypes.CONSUME
  payload: {intentId: string}
}

export interface DetachAiChatContextAction {
  type: AiChatContextActionTypes.DETACH
  payload: {capsuleId: string}
}

export interface ClearAiChatContextAction {
  type: AiChatContextActionTypes.CLEAR
}

export type AiChatContextAction =
  | SendToAiChatAction
  | ConsumeAiChatIntentAction
  | DetachAiChatContextAction
  | ClearAiChatContextAction

/**
 * The single entry point any screen uses to talk to AI Chat.
 *
 * Usable from a hook (src/ai_chat/hooks/useAiContext) or straight from
 * mapDispatchToProps, since most of this codebase connects rather than hooks.
 */
export const sendToAiChat = (intent: AiChatIntent): SendToAiChatAction => ({
  type: AiChatContextActionTypes.SEND,
  payload: {...intent, intentId: uuid.v4()},
})

/** Marks an intent as delivered so it is never replayed. */
export const consumeAiChatIntent = (
  intentId: string
): ConsumeAiChatIntentAction => ({
  type: AiChatContextActionTypes.CONSUME,
  payload: {intentId},
})

export const detachAiChatContext = (
  capsuleId: string
): DetachAiChatContextAction => ({
  type: AiChatContextActionTypes.DETACH,
  payload: {capsuleId},
})

export const clearAiChatContext = (): ClearAiChatContextAction => ({
  type: AiChatContextActionTypes.CLEAR,
})
