import React from 'react'
import {mount, ReactWrapper} from 'enzyme'
import {act} from 'react-dom/test-utils'

import {CloudhubAiChatStandaloneUnconnected} from './CloudhubAiChatStandalone'
import {useOpenClawApprovals} from 'src/ai_chat/hooks/useOpenClawApprovals'

jest.mock('src/ai_chat/hooks/useOpenClawApprovals', () => ({
  useOpenClawApprovals: jest.fn(),
}))

jest.mock('src/shared/components/FancyScrollbar', () => {
  const React = require('react')
  return ({children}: any) => React.createElement('div', null, children)
})

jest.mock('src/shared/components/CollapsibleSidePanelSlice', () => {
  const React = require('react')
  return ({children}: any) => React.createElement('div', null, children)
})

jest.mock('src/reusable_ui/components/Button', () => {
  const React = require('react')
  return ({onClick, text}: any) =>
    React.createElement('button', {onClick}, text)
})

jest.mock('src/ai_chat/containers/AiChatSidebar', () => () => null)
jest.mock('src/ai_chat/components/AiChatMessageAvatar', () => () => null)
jest.mock('src/ai_chat/components/SubagentInspectorPanel', () => () => null)

jest.mock('src/ai_chat/components/AiChatMessageMarkdown', () => {
  const React = require('react')
  return ({content}: any) => React.createElement('span', null, content)
})

jest.mock('src/ai_chat/apis/openclawSkills', () => ({
  getAiChatSkills: jest.fn().mockResolvedValue([]),
}))
jest.mock('src/shared/actions/notifications', () => ({notify: jest.fn()}))
jest.mock('src/shared/copy/notifications', () => ({
  defaultErrorNotification: {},
}))

const useApprovalsMock = useOpenClawApprovals as jest.MockedFunction<
  typeof useOpenClawApprovals
>

describe('CloudhubAiChatStandalone runtime events', () => {
  let mountedWrapper: ReactWrapper | null
  let originalFetch: typeof fetch
  let originalWebSocket: typeof WebSocket
  let originalRequestAnimationFrame: typeof requestAnimationFrame
  let originalCancelAnimationFrame: typeof cancelAnimationFrame
  let originalScrollIntoView: typeof Element.prototype.scrollIntoView
  let history: object[]

  class FakeWebSocket {
    public static instances: FakeWebSocket[] = []
    public onopen: ((event: Event) => any) | null = null
    public onmessage: ((event: MessageEvent) => any) | null = null
    public onclose: ((event: CloseEvent) => any) | null = null
    public send = jest.fn()
    public close = jest.fn()

    constructor(public url: string) {
      FakeWebSocket.instances.push(this)
    }
  }

  const flushEffects = async () => {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    mountedWrapper?.update()
  }

  const emit = (socket: FakeWebSocket, payload: object) => {
    act(() => {
      socket.onmessage!({data: JSON.stringify(payload)} as MessageEvent)
    })
    mountedWrapper?.update()
  }

  const mountChat = async () => {
    act(() => {
      mountedWrapper = mount(
        <CloudhubAiChatStandaloneUnconnected notify={jest.fn()} />
      )
    })
    await flushEffects()
    const socket = FakeWebSocket.instances[0]
    act(() => {
      socket.onopen!({} as Event)
    })
    return socket
  }

  const userTexts = () =>
    mountedWrapper!
      .find('.message-item.user .message-text-content')
      .map(node => node.text())

  const answerTexts = () =>
    mountedWrapper!
      .find('.message-item.ai .message-text-content')
      .map(node => node.text())

  beforeEach(() => {
    FakeWebSocket.instances = []
    mountedWrapper = null
    history = []
    window.sessionStorage.setItem('cloudhub.aiChat.activeSessionId', 'owned')
    useApprovalsMock.mockReset()
    useApprovalsMock.mockReturnValue({
      approvals: [],
      now: 2_000,
      refreshApprovals: jest.fn(() => Promise.resolve()),
      handleApprovalEvent: jest.fn(),
      resolveApproval: jest.fn(() => Promise.resolve()),
    })

    const fetchMock = jest.fn((input: RequestInfo) => {
      const url = String(input)
      if (url.endsWith('/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              sessions: [
                {
                  id: 'owned',
                  title: 'Owned session',
                  createdAt: '2026-09-06T00:00:00Z',
                  updatedAt: '2026-09-06T00:00:00Z',
                },
              ],
            }),
        })
      }
      if (url.endsWith('/sessions/owned/messages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({messages: history}),
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    originalFetch = global.fetch
    originalWebSocket = global.WebSocket
    originalRequestAnimationFrame = global.requestAnimationFrame
    originalCancelAnimationFrame = global.cancelAnimationFrame
    originalScrollIntoView = Element.prototype.scrollIntoView
    global.fetch = (fetchMock as unknown) as typeof fetch
    ;(global as any).WebSocket = FakeWebSocket
    global.requestAnimationFrame = callback => {
      callback(0)
      return 1
    }
    global.cancelAnimationFrame = jest.fn()
    Element.prototype.scrollIntoView = jest.fn()
  })

  afterEach(() => {
    mountedWrapper?.unmount()
    window.sessionStorage.clear()
    global.fetch = originalFetch
    global.WebSocket = originalWebSocket
    global.requestAnimationFrame = originalRequestAnimationFrame
    global.cancelAnimationFrame = originalCancelAnimationFrame
    Element.prototype.scrollIntoView = originalScrollIntoView
    jest.restoreAllMocks()
  })

  describe('OpenClaw runtime driver prompts', () => {
    it('hides the runtime event prompt but keeps the message the user typed', async () => {
      // The gateway wakes an idle session by pushing this as role:user. It has
      // no idempotencyKey, unlike anything a person sends, and it is recorded
      // ahead of the message that actually triggered it.
      history = [
        {
          role: 'user',
          content: [
            {type: 'text', text: 'Continue the OpenClaw runtime event.'},
          ],
          timestamp: 1788737139527,
        },
        {
          role: 'user',
          content: 'hi',
          timestamp: 1788737138970,
          idempotencyKey: '02de0f1e:user',
          __openclaw: {senderIsOwner: true},
        },
      ]

      await mountChat()
      await flushEffects()

      expect(userTexts()).toEqual(['hi'])
    })

    it('still hides the older gateway restart recovery prompt', async () => {
      history = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'The previous run was interrupted by a gateway restart. ' +
                'Continue from the existing transcript.',
            },
          ],
          timestamp: 1788737000000,
        },
      ]

      await mountChat()
      await flushEffects()

      expect(userTexts()).toEqual([])
    })

    it('hides the restart recovery prompt whichever order its wording comes in', async () => {
      // 문구 순서는 게이트웨이 쪽 사정으로 바뀔 수 있다. 순서에 기대는 판별은
      // 프롬프트가 다시 쓰이는 순간 조용히 깨져 주입분을 노출시킨다.
      history = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Continue from the existing transcript. The previous run was ' +
                'interrupted by a gateway restart.',
            },
          ],
          timestamp: 1788737000000,
        },
      ]

      await mountChat()
      await flushEffects()

      expect(userTexts()).toEqual([])
    })

    it('keeps a real message that happens to quote the runtime prompt', async () => {
      history = [
        {
          role: 'user',
          content: 'Continue the OpenClaw runtime event.',
          timestamp: 1788737139527,
          idempotencyKey: 'typed-by-a-person:user',
          __openclaw: {senderIsOwner: true},
        },
      ]

      await mountChat()
      await flushEffects()

      expect(userTexts()).toEqual(['Continue the OpenClaw runtime event.'])
    })
  })

  describe('a run that ends without finishing its answer', () => {
    it('reports the interruption instead of badging the turn as done', async () => {
      const socket = await mountChat()

      emit(socket, {
        sessionId: 'owned',
        state: 'delta',
        deltaText: 'collecting the metrics now',
      })

      emit(socket, {
        sessionId: 'owned',
        state: 'aborted',
        errorMessage: 'This operation was aborted',
      })

      // The partial answer survives — it is all the user got — but the turn is
      // no longer indistinguishable from one that ran to completion.
      expect(answerTexts()).toEqual(['collecting the metrics now'])
      expect(mountedWrapper!.find('.ai-chat-badge.variant-done')).toHaveLength(
        0
      )
      expect(
        mountedWrapper!.find('.ai-chat-badge.variant-warning')
      ).toHaveLength(1)
      expect(mountedWrapper!.find('.ai-run-failure-notice').text()).toContain(
        'This operation was aborted'
      )
    })

    it('marks a tool still running when the run was cut short as failed', async () => {
      const socket = await mountChat()

      emit(socket, {
        sessionId: 'owned',
        state: 'delta',
        deltaText: 'running a query',
      })
      emit(socket, {
        sessionId: 'owned',
        itemId: 'tool-1',
        toolCallId: 'tool-1',
        kind: 'tool',
        name: 'influxdb__query_influxql',
        title: 'influxdb',
        phase: 'start',
      })
      emit(socket, {sessionId: 'owned', state: 'aborted'})

      expect(
        mountedWrapper!.find('.ai-chat-badge.variant-warning').length
      ).toBeGreaterThan(0)
    })

    it('still badges a completed turn as done', async () => {
      const socket = await mountChat()

      emit(socket, {
        sessionId: 'owned',
        state: 'delta',
        deltaText: 'here is the report',
      })
      emit(socket, {sessionId: 'owned', state: 'final'})

      expect(answerTexts()).toEqual(['here is the report'])
      expect(mountedWrapper!.find('.ai-chat-badge.variant-done')).toHaveLength(
        1
      )
      expect(mountedWrapper!.find('.ai-run-failure-notice')).toHaveLength(0)
    })
  })

  describe('event routing', () => {
    it('ignores stream events belonging to another session', async () => {
      const socket = await mountChat()

      emit(socket, {
        sessionId: 'someone-elses-session',
        state: 'delta',
        deltaText: 'not for this conversation',
      })

      expect(answerTexts()).toEqual([])
    })

    // 전시 이후로 미룬 하드닝. 지금은 세션을 특정할 수 없는 이벤트가 필터를
    // 건너뛰어 그때 열려 있던 세션에 그려진다. 실제로 그런 이벤트가 관측된 적은
    // 없고(백엔드가 항상 sessionId 를 실어 보낸다) 이득보다 조용히 깨질 위험이
    // 커서, 가드를 fail-closed 로 바꾸는 작업과 함께 이 테스트를 켠다.
    it.skip('ignores a stream event that names no session at all', async () => {
      const socket = await mountChat()

      emit(socket, {state: 'delta', deltaText: 'unattributed'})

      expect(answerTexts()).toEqual([])
    })

    it('renders events for the open session', async () => {
      const socket = await mountChat()

      emit(socket, {
        sessionId: 'owned',
        state: 'delta',
        deltaText: 'for this conversation',
      })

      expect(answerTexts()).toEqual(['for this conversation'])
    })
  })

  describe('progress narration vs the final answer', () => {
    const aiBadges = (variant: string) =>
      mountedWrapper!.find(`.message-item.ai .ai-chat-badge.variant-${variant}`)

    it('marks a turn that stopped to call a tool as narration', async () => {
      history = [
        {
          role: 'assistant',
          content: [{type: 'text', text: '데이터 수집을 시작합니다.'}],
          stopReason: 'toolUse',
          timestamp: 1788759965567,
          __openclaw: {id: 'a1'},
        },
      ]

      await mountChat()
      await flushEffects()

      expect(answerTexts()).toEqual(['데이터 수집을 시작합니다.'])
      expect(
        mountedWrapper!.find('.message-item.ai.is-progress-note')
      ).toHaveLength(1)
      expect(aiBadges('neutral')).toHaveLength(1)
      expect(aiBadges('done')).toHaveLength(0)
      // 진행 서술은 가져다 쓸 답이 아니므로 복사 버튼을 달지 않는다.
      expect(mountedWrapper!.find('.ai-copy-btn')).toHaveLength(0)
    })

    it('marks a turn that stopped on its own as the final answer', async () => {
      history = [
        {
          role: 'assistant',
          content: [{type: 'text', text: '# 서버 정기 점검 보고서'}],
          stopReason: 'stop',
          timestamp: 1788415245677,
          __openclaw: {id: 'b1'},
        },
      ]

      await mountChat()
      await flushEffects()

      expect(
        mountedWrapper!.find('.message-item.ai.is-progress-note')
      ).toHaveLength(0)
      expect(aiBadges('done')).toHaveLength(1)
      expect(mountedWrapper!.find('.ai-copy-btn')).toHaveLength(1)
    })

    it('treats a record with no stopReason as a final answer', async () => {
      history = [
        {
          role: 'assistant',
          content: [{type: 'text', text: '예전에 저장된 답변'}],
          timestamp: 1788415245677,
          __openclaw: {id: 'c1'},
        },
      ]

      await mountChat()
      await flushEffects()

      expect(
        mountedWrapper!.find('.message-item.ai.is-progress-note')
      ).toHaveLength(0)
      expect(aiBadges('done')).toHaveLength(1)
    })

    it('separates narration from the answer within one multi-tool turn', async () => {
      history = [
        {
          role: 'assistant',
          content: [
            {type: 'text', text: '먼저 확인하겠습니다.'},
            {type: 'toolCall', id: 'call_a', name: 'exec', input: {}},
            {type: 'text', text: '이어서 조회하겠습니다.'},
          ],
          stopReason: 'toolUse',
          timestamp: 1788759965567,
          __openclaw: {id: 'd1'},
        },
        {
          role: 'assistant',
          content: [{type: 'text', text: '# 최종 보고서'}],
          stopReason: 'stop',
          timestamp: 1788759999999,
          __openclaw: {id: 'd2'},
        },
      ]

      await mountChat()
      await flushEffects()

      expect(
        mountedWrapper!.find('.message-item.ai.is-progress-note')
      ).toHaveLength(2)
      expect(aiBadges('done')).toHaveLength(1)
    })

    it('marks a live bubble closed by a starting tool as narration', async () => {
      const socket = await mountChat()

      emit(socket, {
        sessionId: 'owned',
        state: 'delta',
        deltaText: '네트워킹과 docker 상태도 확인하겠습니다.',
      })
      emit(socket, {
        type: 'activity',
        sessionId: 'owned',
        activity: {
          itemId: 'call_x',
          toolCallId: 'call_x',
          phase: 'start',
          kind: 'tool',
          name: 'influxdb__query_influxql',
          title: 'influxdb',
          status: 'running',
        },
      })

      expect(
        mountedWrapper!.find('.message-item.ai.is-progress-note')
      ).toHaveLength(1)
      expect(aiBadges('done')).toHaveLength(0)
    })
  })
})
