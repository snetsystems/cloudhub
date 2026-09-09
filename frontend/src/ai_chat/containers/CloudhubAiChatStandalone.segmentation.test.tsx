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

// The split is about which bubble a sentence lands in, so the answer text has
// to reach the DOM. The other suites stub this out.
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

describe('CloudhubAiChatStandalone turn segmentation', () => {
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

  const answerTexts = () =>
    mountedWrapper!.find('.message-text-content').map(node => node.text())

  beforeEach(() => {
    FakeWebSocket.instances = []
    mountedWrapper = null
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

  it('opens a new answer bubble once a tool runs mid-turn', async () => {
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

    emit(socket, {
      sessionId: 'owned',
      state: 'delta',
      deltaText: 'checking the server first',
    })
    expect(answerTexts()).toEqual(['checking the server first'])

    emit(socket, {
      sessionId: 'owned',
      itemId: 'tool-1',
      toolCallId: 'tool-1',
      kind: 'tool',
      name: 'shell',
      title: 'shell',
      phase: 'start',
    })

    emit(socket, {
      sessionId: 'owned',
      state: 'delta',
      deltaText: 'the report follows',
    })

    // The narration that introduced the tool keeps its own bubble, and the
    // sentence written after the tool ran starts a fresh one.
    expect(answerTexts()).toEqual([
      'checking the server first',
      'the report follows',
    ])
    expect(mountedWrapper!.find('.ai-tool-activity-summary-bar')).toHaveLength(
      1
    )
  })

  it('keeps back-to-back tools in one bubble when no sentence separates them', async () => {
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

    emit(socket, {
      sessionId: 'owned',
      state: 'delta',
      deltaText: 'running two tools',
    })
    emit(socket, {
      sessionId: 'owned',
      itemId: 'tool-1',
      toolCallId: 'tool-1',
      kind: 'tool',
      name: 'shell',
      title: 'shell',
      phase: 'start',
    })
    emit(socket, {
      sessionId: 'owned',
      itemId: 'tool-2',
      toolCallId: 'tool-2',
      kind: 'tool',
      name: 'influx',
      title: 'influx',
      phase: 'start',
    })

    // Two tools, but only one gap in the narration: one activity group.
    expect(mountedWrapper!.find('.ai-tool-activity-summary-bar')).toHaveLength(
      1
    )
    expect(answerTexts()).toEqual(['running two tools'])
  })
})
