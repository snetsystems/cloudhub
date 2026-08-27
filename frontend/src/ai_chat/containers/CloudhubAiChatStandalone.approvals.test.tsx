import React from 'react'
import {mount, ReactWrapper, shallow} from 'enzyme'
import {act} from 'react-dom/test-utils'

import OpenClawApprovalCard from 'src/ai_chat/components/OpenClawApprovalCard'
import {OpenClawApprovalEventDTO} from 'src/ai_chat/apis/openclawApi'
import {OpenClawApprovalView} from 'src/ai_chat/utils/openclawApprovalState'
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

jest.mock(
  'src/ai_chat/containers/AiChatSidebar',
  () => () => null
)
jest.mock(
  'src/ai_chat/components/AiChatMessageMarkdown',
  () => () => null
)
jest.mock(
  'src/ai_chat/components/AiChatMessageAvatar',
  () => () => null
)
jest.mock(
  'src/ai_chat/components/SubagentInspectorPanel',
  () => () => null
)
jest.mock('src/shared/actions/notifications', () => ({notify: jest.fn()}))
jest.mock('src/shared/copy/notifications', () => ({
  defaultErrorNotification: {},
}))

const pendingApproval: OpenClawApprovalView = {
  id: 'approval-a',
  source: 'native',
  title: 'Restart production service',
  description: 'Restart the selected service.',
  severity: 'high',
  toolName: 'shell',
  allowedDecisions: ['allow-once', 'deny'],
  createdAt: 1_000,
  expiresAt: 61_000,
  state: 'pending',
}

const useApprovalsMock = useOpenClawApprovals as jest.MockedFunction<
  typeof useOpenClawApprovals
>

describe('CloudhubAiChatStandalone approval integration', () => {
  const lifecycle: string[] = []
  const refreshApprovals = jest.fn(() => {
    lifecycle.push('refresh')
    return Promise.resolve()
  })
  const handleApprovalEvent = jest.fn()
  const resolveApproval = jest.fn(() => Promise.resolve())
  let fetchMock: jest.Mock
  let mountedWrapper: ReactWrapper | null
  let originalFetch: typeof fetch
  let originalWebSocket: typeof WebSocket
  let originalRequestAnimationFrame: typeof requestAnimationFrame
  let originalCancelAnimationFrame: typeof cancelAnimationFrame
  let originalScrollIntoView: typeof Element.prototype.scrollIntoView

  class FakeWebSocket {
    public static instances: FakeWebSocket[] = []
    public onopen: ((event: Event) => any) | null = null
    public onmessage: ((event: MessageEvent) => any) | null = null
    public onclose: ((event: CloseEvent) => any) | null = null
    public send = jest.fn((data: string) => {
      lifecycle.push(`send:${data}`)
    })
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

  beforeEach(() => {
    lifecycle.length = 0
    FakeWebSocket.instances = []
    mountedWrapper = null
    // These cases are about an ongoing conversation, so put the tab back in the
    // one it was working in. Without this the chat opens on a blank draft and
    // never connects a socket.
    window.sessionStorage.setItem('cloudhub.aiChat.activeSessionId', 'owned')
    refreshApprovals.mockClear()
    handleApprovalEvent.mockClear()
    resolveApproval.mockClear()
    useApprovalsMock.mockReset()
    useApprovalsMock.mockReturnValue({
      approvals: [pendingApproval],
      now: 2_000,
      refreshApprovals,
      handleApprovalEvent,
      resolveApproval,
    })

    fetchMock = jest.fn((input: RequestInfo) => {
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
                  createdAt: '2026-08-16T00:00:00Z',
                  updatedAt: '2026-08-16T00:00:00Z',
                },
              ],
            }),
        })
      }
      if (url.endsWith('/sessions/owned/messages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({messages: []}),
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

  it('renders an approval immediately before the timeline end without the empty-thread UI', () => {
    const wrapper = shallow(<CloudhubAiChatStandaloneUnconnected />)

    const card = wrapper.find(OpenClawApprovalCard)
    expect(card).toHaveLength(1)
    expect(card.prop('approval')).toBe(pendingApproval)
    expect(card.prop('now')).toBe(2_000)
    expect(card.prop('onResolve')).toBe(resolveApproval)
    expect(wrapper.text()).not.toContain('새로운 대화를 시작해보세요')

    const timelineChildren = wrapper.find('.message-list').children()
    expect(
      timelineChildren
        .at(timelineChildren.length - 2)
        .hasClass('approval-message-item')
    ).toBe(true)
  })

  it('scrolls when the approval ID set changes, not for clock or state-only updates', async () => {
    act(() => {
      mountedWrapper = mount(<CloudhubAiChatStandaloneUnconnected />)
    })
    await flushEffects()

    const scrollIntoView = Element.prototype.scrollIntoView as jest.Mock
    scrollIntoView.mockClear()

    useApprovalsMock.mockReturnValue({
      approvals: [pendingApproval],
      now: 3_000,
      refreshApprovals,
      handleApprovalEvent,
      resolveApproval,
    })
    act(() => {
      mountedWrapper!.setProps({customClass: 'clock-tick'})
    })
    expect(scrollIntoView).not.toHaveBeenCalled()

    const resolvingApproval: OpenClawApprovalView = {
      ...pendingApproval,
      state: 'resolving',
    }
    useApprovalsMock.mockReturnValue({
      approvals: [resolvingApproval],
      now: 3_000,
      refreshApprovals,
      handleApprovalEvent,
      resolveApproval,
    })
    act(() => {
      mountedWrapper!.setProps({customClass: 'state-change'})
    })
    expect(scrollIntoView).not.toHaveBeenCalled()

    useApprovalsMock.mockReturnValue({
      approvals: [resolvingApproval, {...pendingApproval, id: 'approval-b'}],
      now: 3_000,
      refreshApprovals,
      handleApprovalEvent,
      resolveApproval,
    })
    act(() => {
      mountedWrapper!.setProps({customClass: 'new-approval'})
    })

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'end',
    })
  })

  describe('which conversation opens', () => {
    it('resumes the one this tab was working in', async () => {
      act(() => {
        mountedWrapper = mount(
          <CloudhubAiChatStandaloneUnconnected notify={jest.fn()} />
        )
      })
      await flushEffects()

      // Resuming means loading that conversation's history and listening to it.
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).endsWith('/sessions/owned/messages')
        )
      ).toBe(true)
      expect(FakeWebSocket.instances).toHaveLength(1)
    })

    it('starts on a blank draft for a tab that has not opened chat yet', async () => {
      window.sessionStorage.clear()

      act(() => {
        mountedWrapper = mount(
          <CloudhubAiChatStandaloneUnconnected notify={jest.fn()} />
        )
      })
      await flushEffects()

      // A first visit must not drop the user into whatever was last discussed.
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes('/messages')
        )
      ).toBe(false)
      expect(FakeWebSocket.instances).toHaveLength(0)
    })

    it('starts on a blank draft when the remembered conversation is gone', async () => {
      window.sessionStorage.setItem(
        'cloudhub.aiChat.activeSessionId',
        'deleted-elsewhere'
      )

      act(() => {
        mountedWrapper = mount(
          <CloudhubAiChatStandaloneUnconnected notify={jest.fn()} />
        )
      })
      await flushEffects()

      expect(FakeWebSocket.instances).toHaveLength(0)
      expect(
        window.sessionStorage.getItem('cloudhub.aiChat.activeSessionId')
      ).toBeNull()
    })
  })

  it('stamps a streamed reply with when it arrived, not with the current clock', async () => {
    const arrivedAt = new Date('2026-08-26T10:00:00Z').getTime()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(arrivedAt)

    try {
      act(() => {
        mountedWrapper = mount(
          <CloudhubAiChatStandaloneUnconnected notify={jest.fn()} />
        )
      })
      await flushEffects()

      const socket = FakeWebSocket.instances[0]
      const emit = (payload: Record<string, unknown>) =>
        act(() => {
          socket.onmessage?.({
            data: JSON.stringify({sessionId: 'owned', ...payload}),
          } as MessageEvent)
        })

      emit({
        type: 'message',
        state: 'delta',
        message: {
          role: 'assistant',
          content: [{type: 'text', text: '진단 결과입니다'}],
        },
      })
      emit({
        type: 'message',
        state: 'final',
        message: {
          role: 'assistant',
          content: [{type: 'text', text: '진단 결과입니다'}],
        },
      })
      mountedWrapper!.update()

      const shown = () =>
        mountedWrapper!
          .find('.message-timestamp')
          .last()
          .text()

      const atArrival = shown()

      // An hour later the reply still arrived an hour ago. The bubble renders
      // from timestampRaw; without it the render falls back to the
      // preformatted "HH:mm" string, which never parses, and the message would
      // report the current time on every re-render.
      nowSpy.mockReturnValue(arrivedAt + 60 * 60 * 1000)
      act(() => {
        mountedWrapper!.setProps({customClass: 'later'})
      })
      mountedWrapper!.update()

      expect(shown()).toBe(atArrival)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('re-reads history on reconnect, so a reply that finished during an outage is not left streaming', async () => {
    jest.useFakeTimers()

    try {
      act(() => {
        mountedWrapper = mount(
          <CloudhubAiChatStandaloneUnconnected notify={jest.fn()} />
        )
      })
      await flushEffects()

      const first = FakeWebSocket.instances[0]

      act(() => {
        first.onopen?.({} as Event)
      })

      const historyReadsBefore = fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith('/sessions/owned/messages')
      ).length

      // The gateway drops the socket mid-reply.
      act(() => {
        first.onclose?.({} as CloseEvent)
      })
      act(() => {
        jest.advanceTimersByTime(2_000)
      })

      expect(FakeWebSocket.instances).toHaveLength(2)

      act(() => {
        FakeWebSocket.instances[1].onopen?.({} as Event)
      })

      // Whatever the run did while the socket was down only exists in history.
      // Without this read the placeholder stays isStreaming and the composer
      // stays disabled until the page is reloaded.
      const historyReadsAfter = fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith('/sessions/owned/messages')
      ).length

      expect(historyReadsAfter).toBeGreaterThan(historyReadsBefore)
    } finally {
      jest.useRealTimers()
    }
  })

  it('backs off instead of hammering a gateway that stays down', async () => {
    jest.useFakeTimers()

    try {
      act(() => {
        mountedWrapper = mount(
          <CloudhubAiChatStandaloneUnconnected notify={jest.fn()} />
        )
      })
      await flushEffects()

      const dropAndWait = (ms: number) => {
        act(() => {
          FakeWebSocket.instances[
            FakeWebSocket.instances.length - 1
          ].onclose?.({} as CloseEvent)
        })
        act(() => {
          jest.advanceTimersByTime(ms)
        })
      }

      dropAndWait(2_000)
      expect(FakeWebSocket.instances).toHaveLength(2)

      // The second retry waits longer than the first, so a gateway that is
      // down is not retried every two seconds forever.
      dropAndWait(2_000)
      expect(FakeWebSocket.instances).toHaveLength(2)

      act(() => {
        jest.advanceTimersByTime(2_000)
      })
      expect(FakeWebSocket.instances).toHaveLength(3)
    } finally {
      jest.useRealTimers()
    }
  })

  it('routes approval WebSocket events and refreshes approvals with session changes', async () => {
    act(() => {
      mountedWrapper = mount(
        <CloudhubAiChatStandaloneUnconnected notify={jest.fn()} />
      )
    })
    await flushEffects()

    expect(FakeWebSocket.instances).toHaveLength(1)
    const socket = FakeWebSocket.instances[0]
    const hookCalls = useApprovalsMock.mock.calls
    expect(hookCalls.length).toBeGreaterThan(1)
    expect(hookCalls[0][1]).toBe(hookCalls[hookCalls.length - 1][1])

    act(() => {
      socket.onopen!({} as Event)
    })
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({sessionId: 'owned'})
    )
    expect(lifecycle).toEqual([
      `send:${JSON.stringify({sessionId: 'owned'})}`,
      'refresh',
    ])

    const requestedEvent: OpenClawApprovalEventDTO & {
      itemId: string
      deltaText: string
    } = {
      type: 'approval.requested',
      sessionId: 'owned',
      approval: pendingApproval,
      itemId: 'requested-event-must-not-become-activity',
      deltaText: 'requested event must not become a message',
    }
    const resolvedEvent: OpenClawApprovalEventDTO & {
      itemId: string
      deltaText: string
    } = {
      type: 'approval.resolved',
      sessionId: 'owned',
      approval: {
        ...pendingApproval,
        decision: 'deny' as const,
        resolvedAt: 2_500,
      },
      itemId: 'resolved-event-must-not-become-activity',
      deltaText: 'resolved event must not become a message',
    }

    act(() => {
      socket.onmessage!({
        data: JSON.stringify(requestedEvent),
      } as MessageEvent)
      socket.onmessage!({
        data: JSON.stringify(resolvedEvent),
      } as MessageEvent)
    })
    mountedWrapper.update()

    expect(handleApprovalEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({type: 'approval.requested'})
    )
    expect(handleApprovalEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({type: 'approval.resolved'})
    )
    expect(mountedWrapper.text()).not.toContain(
      'requested event must not become a message'
    )
    expect(mountedWrapper.text()).not.toContain(
      'resolved event must not become a message'
    )
    expect(mountedWrapper.text()).not.toContain(
      'requested-event-must-not-become-activity'
    )
    expect(mountedWrapper.text()).not.toContain(
      'resolved-event-must-not-become-activity'
    )

    const messageFetchesBeforeSessionChange = fetchMock.mock.calls.filter(
      ([input]) => String(input).endsWith('/sessions/owned/messages')
    ).length
    act(() => {
      socket.onmessage!({
        data: JSON.stringify({type: 'sessions.changed'}),
      } as MessageEvent)
    })
    await flushEffects()

    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith('/sessions/owned/messages')
      )
    ).toHaveLength(messageFetchesBeforeSessionChange + 1)
    expect(refreshApprovals).toHaveBeenCalledTimes(2)
  })

  it('replaces local messages with server history without duplicating messages on sessions.changed', async () => {
    const serverMessages = [
      {
        role: 'user',
        content: [{type: 'text', text: 'Question A'}],
        timestamp: 1000,
      },
      {
        role: 'assistant',
        content: [{type: 'text', text: 'Answer A'}],
        timestamp: 2000,
      },
    ]

    fetchMock.mockImplementation((input: RequestInfo) => {
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
                  createdAt: '2026-08-16T00:00:00Z',
                  updatedAt: '2026-08-16T00:00:00Z',
                },
              ],
            }),
        })
      }
      if (url.endsWith('/sessions/owned/messages')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({messages: serverMessages}),
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    act(() => {
      mountedWrapper = mount(<CloudhubAiChatStandaloneUnconnected />)
    })
    await flushEffects()

    const socket = FakeWebSocket.instances[0]
    expect(socket).toBeDefined()

    // Trigger sessions.changed multiple times
    act(() => {
      socket.onmessage!({
        data: JSON.stringify({type: 'sessions.changed'}),
      } as MessageEvent)
    })
    await flushEffects()

    act(() => {
      socket.onmessage!({
        data: JSON.stringify({type: 'sessions.changed'}),
      } as MessageEvent)
    })
    await flushEffects()

    const userMessages = mountedWrapper.find('.message-item.user')
    expect(userMessages).toHaveLength(1)
    expect(userMessages.text()).toContain('Question A')
  })
})
