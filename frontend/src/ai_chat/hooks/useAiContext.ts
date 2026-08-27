import {useCallback} from 'react'
import {useDispatch, useSelector} from 'react-redux'

import {openAiAgentsDrawer} from 'src/shared/actions/aiAgentsDrawer'
import {
  clearAiChatContext,
  detachAiChatContext,
  sendToAiChat as sendToAiChatAction,
} from 'src/shared/actions/aiChatContext'
import {
  AiChatContextState,
  AiChatIntent,
  AiContextCapsule,
} from 'src/types/aiChatContext'

interface UseAiContext {
  attachments: AiContextCapsule[]
  sendToAiChat: (intent: AiChatIntent) => void
  detach: (capsuleId: string) => void
  clear: () => void
}

/**
 * The one call any screen makes to hand data to AI Chat.
 *
 *   const {sendToAiChat} = useAiContext()
 *
 *   sendToAiChat({
 *     autoSend: true,
 *     prompt: `${host.name} 서버의 부하 원인을 진단해줘.`,
 *     context: {
 *       id: `host:${host.name}`,
 *       type: 'server',
 *       sourcePage: 'server-list',
 *       title: host.name,
 *       summary: `CPU ${host.cpu}%`,
 *       payload: host,
 *       capturedAt: Date.now(),
 *     },
 *   })
 *
 * Class components and existing connected pages can dispatch
 * `sendToAiChat` from src/shared/actions/aiChatContext directly instead.
 */
export const useAiContext = (): UseAiContext => {
  const dispatch = useDispatch()
  const attachments = useSelector(
    (state: {aiChatContext?: AiChatContextState}) =>
      state.aiChatContext?.attachments || []
  )

  const sendToAiChat = useCallback(
    (intent: AiChatIntent) => {
      dispatch(sendToAiChatAction(intent))

      // Opening here rather than inside AI Chat keeps the chat unaware of the
      // drawer: the same intent works on the full-page chat, which has none.
      if (intent.openDrawer !== false) {
        dispatch(openAiAgentsDrawer())
      }
    },
    [dispatch]
  )

  const detach = useCallback(
    (capsuleId: string) => dispatch(detachAiChatContext(capsuleId)),
    [dispatch]
  )

  const clear = useCallback(() => dispatch(clearAiChatContext()), [dispatch])

  return {attachments, sendToAiChat, detach, clear}
}

export default useAiContext
