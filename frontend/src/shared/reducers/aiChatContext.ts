import {
  AiChatContextAction,
  AiChatContextActionTypes,
} from 'src/shared/actions/aiChatContext'
import {AiChatContextState} from 'src/types/aiChatContext'

const initialState: AiChatContextState = {
  pendingIntent: null,
  attachments: [],
}

const aiChatContextReducer = (
  state: AiChatContextState = initialState,
  action: AiChatContextAction
): AiChatContextState => {
  switch (action.type) {
    case AiChatContextActionTypes.SEND: {
      const {context} = action.payload

      // Attaching the same subject twice replaces it rather than stacking, so
      // re-clicking a row refreshes its numbers instead of duplicating a chip.
      const attachments = context
        ? [...state.attachments.filter(c => c.id !== context.id), context]
        : state.attachments

      return {pendingIntent: action.payload, attachments}
    }

    case AiChatContextActionTypes.CONSUME: {
      // Ignore a stale acknowledgement: a newer intent may already be waiting.
      if (state.pendingIntent?.intentId !== action.payload.intentId) {
        return state
      }

      return {...state, pendingIntent: null}
    }

    case AiChatContextActionTypes.DETACH: {
      return {
        ...state,
        attachments: state.attachments.filter(
          c => c.id !== action.payload.capsuleId
        ),
      }
    }

    case AiChatContextActionTypes.CLEAR: {
      return {...state, attachments: []}
    }

    default:
      return state
  }
}

export default aiChatContextReducer
