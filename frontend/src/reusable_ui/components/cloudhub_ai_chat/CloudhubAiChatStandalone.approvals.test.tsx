import React from 'react'
import {mount, ReactWrapper, shallow} from 'enzyme'
import {act} from 'react-dom/test-utils'

import OpenClawApprovalCard from './OpenClawApprovalCard'
import {OpenClawApprovalEventDTO} from './openclawApi'
import {OpenClawApprovalView} from './openclawApprovalState'
import {CloudhubAiChatStandaloneUnconnected} from './CloudhubAiChatStandalone'
import {useOpenClawApprovals} from './useOpenClawApprovals'

jest.mock('./useOpenClawApprovals', () => ({
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
  'src/reusable_ui/components/cloudhub_ai_chat/AiChatSidebar',
  () => () => null
)
jest.mock(
  'src/reusable_ui/components/cloudhub_ai_chat/AiChatMessageMarkdown',
  () => () => null
)
jest.mock(
  'src/reusable_ui/components/cloudhub_ai_chat/AiChatMessageAvatar',
  () => () => null
)
jest.mock(
  'src/reusable_ui/components/cloudhub_ai_chat/SubagentInspectorPanel',
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
})
