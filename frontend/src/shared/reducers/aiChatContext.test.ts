import aiChatContextReducer from 'src/shared/reducers/aiChatContext'
import {
  clearAiChatContext,
  consumeAiChatIntent,
  detachAiChatContext,
  sendToAiChat,
} from 'src/shared/actions/aiChatContext'
import {AiChatContextState, AiContextCapsule} from 'src/types/aiChatContext'

const capsule = (id: string, summary = ''): AiContextCapsule => ({
  id,
  type: 'server',
  sourcePage: 'server-list',
  title: id,
  summary,
  payload: {name: id},
  capturedAt: 0,
})

const initial: AiChatContextState = {pendingIntent: null, attachments: []}

describe('aiChatContext reducer', () => {
  it('queues an intent with the id AI Chat acknowledges it by', () => {
    const action = sendToAiChat({prompt: '진단해줘', autoSend: true})
    const state = aiChatContextReducer(initial, action)

    expect(state.pendingIntent).toMatchObject({
      prompt: '진단해줘',
      autoSend: true,
      intentId: action.payload.intentId,
    })
  })

  it('clears the intent once AI Chat acknowledges that exact delivery', () => {
    const action = sendToAiChat({prompt: '진단해줘', autoSend: true})
    const queued = aiChatContextReducer(initial, action)

    const consumed = aiChatContextReducer(
      queued,
      consumeAiChatIntent(action.payload.intentId)
    )

    expect(consumed.pendingIntent).toBeNull()
  })

  it('keeps a newer intent when a stale acknowledgement arrives', () => {
    const first = sendToAiChat({prompt: '첫번째'})
    const second = sendToAiChat({prompt: '두번째'})

    let state = aiChatContextReducer(initial, first)
    state = aiChatContextReducer(state, second)
    state = aiChatContextReducer(
      state,
      consumeAiChatIntent(first.payload.intentId)
    )

    expect(state.pendingIntent?.prompt).toBe('두번째')
  })

  it('refreshes an already attached subject instead of stacking a duplicate chip', () => {
    let state = aiChatContextReducer(
      initial,
      sendToAiChat({context: capsule('web-01', 'CPU 40%')})
    )
    state = aiChatContextReducer(
      state,
      sendToAiChat({context: capsule('web-01', 'CPU 94%')})
    )

    expect(state.attachments).toHaveLength(1)
    expect(state.attachments[0].summary).toBe('CPU 94%')
  })

  it('carries a suggested skill so the composer can seed it as editable text', () => {
    const action = sendToAiChat({
      skill: '/cloudhub_critical_alerts_audit',
      context: capsule('web-01'),
    })
    const state = aiChatContextReducer(initial, action)

    expect(state.pendingIntent?.skill).toBe('/cloudhub_critical_alerts_audit')
    expect(state.pendingIntent?.autoSend).toBeUndefined()
  })

  it('detaches one subject and clears the rest on send', () => {
    let state = aiChatContextReducer(
      initial,
      sendToAiChat({context: capsule('web-01')})
    )
    state = aiChatContextReducer(
      state,
      sendToAiChat({context: capsule('web-02')})
    )

    state = aiChatContextReducer(state, detachAiChatContext('web-01'))
    expect(state.attachments.map(c => c.id)).toEqual(['web-02'])

    state = aiChatContextReducer(state, clearAiChatContext())
    expect(state.attachments).toEqual([])
  })
})
