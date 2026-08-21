import React, {useEffect} from 'react'
import {mount, ReactWrapper} from 'enzyme'
import {act} from 'react-dom/test-utils'

import {
  getOpenClawApprovals,
  OpenClawAPIError,
  OpenClawApprovalDTO,
  OpenClawApprovalSnapshotDTO,
  resolveOpenClawApproval,
} from 'src/ai_chat/apis/openclawApi'
import {useOpenClawApprovals} from './useOpenClawApprovals'

jest.mock('src/ai_chat/apis/openclawApi', () => ({
  ...jest.requireActual('src/ai_chat/apis/openclawApi'),
  getOpenClawApprovals: jest.fn(),
  resolveOpenClawApproval: jest.fn(),
}))

type HookValue = ReturnType<typeof useOpenClawApprovals>

interface HarnessProps {
  sessionId: string
  onValue: (value: HookValue) => void
  onError: (message: string) => void
}

const Harness: React.FC<HarnessProps> = ({sessionId, onValue, onError}) => {
  const value = useOpenClawApprovals(sessionId, onError)
  useEffect(() => onValue(value), [value])
  return null
}

const UnstableOnErrorHarness: React.FC<HarnessProps> = ({
  sessionId,
  onValue,
  onError,
}) => {
  const value = useOpenClawApprovals(sessionId, message => onError(message))
  useEffect(() => onValue(value), [value])
  return null
}

const approval = (
  id: string,
  createdAt = 1_000,
  expiresAt = 10_000
): OpenClawApprovalDTO => ({
  id,
  source: 'native',
  title: `Approval ${id}`,
  description: 'Needs a decision',
  severity: 'high',
  toolName: 'shell',
  allowedDecisions: ['allow-once', 'deny'],
  createdAt,
  expiresAt,
})

const completeSnapshot = (
  approvals: OpenClawApprovalDTO[] = []
): OpenClawApprovalSnapshotDTO => ({
  approvals,
  completeSources: ['managed', 'native'],
})

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
}

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return {promise, resolve, reject}
}

const getApprovalsMock = getOpenClawApprovals as jest.MockedFunction<
  typeof getOpenClawApprovals
>
const resolveApprovalMock = resolveOpenClawApproval as jest.MockedFunction<
  typeof resolveOpenClawApproval
>

describe('useOpenClawApprovals', () => {
  let currentTime: number
  let wrappers: ReactWrapper[]

  const flush = async () => {
    await act(async () => {
      await Promise.resolve()
    })
  }

  const renderHook = (
    sessionId: string,
    onError = jest.fn()
  ): {
    wrapper: ReactWrapper<HarnessProps>
    latest: () => HookValue
    onError: jest.Mock
  } => {
    let value!: HookValue
    let wrapper!: ReactWrapper<HarnessProps>
    act(() => {
      wrapper = mount(
        <Harness
          sessionId={sessionId}
          onValue={nextValue => {
            value = nextValue
          }}
          onError={onError}
        />
      )
    })
    wrappers.push(wrapper)
    return {wrapper, latest: () => value, onError}
  }

  beforeEach(() => {
    currentTime = 1_000
    wrappers = []
    jest.useFakeTimers()
    jest.spyOn(Date, 'now').mockImplementation(() => currentTime)
    getApprovalsMock.mockReset()
    getApprovalsMock.mockResolvedValue(completeSnapshot())
    resolveApprovalMock.mockReset()
    resolveApprovalMock.mockResolvedValue()
  })

  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.unmount())
    jest.runOnlyPendingTimers()
    expect(jest.getTimerCount()).toBe(0)
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('loads the active session snapshot on mount', async () => {
    const item = approval('approval-a')
    getApprovalsMock.mockResolvedValueOnce(completeSnapshot([item]))

    const {latest} = renderHook('session-a')
    await flush()

    expect(getApprovalsMock).toHaveBeenCalledTimes(1)
    expect(getApprovalsMock).toHaveBeenCalledWith(
      'session-a',
      expect.any(AbortSignal)
    )
    expect(latest().approvals).toEqual([
      expect.objectContaining({id: item.id, state: 'pending'}),
    ])
    expect(latest().now).toBe(1_000)
  })

  it('retries a failed snapshot twice before succeeding', async () => {
    const item = approval('approval-a')
    getApprovalsMock
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'))
      .mockResolvedValueOnce(completeSnapshot([item]))

    const {latest, onError} = renderHook('session-a')
    await flush()
    expect(getApprovalsMock).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()

    act(() => {
      currentTime = 1_500
      jest.advanceTimersByTime(500)
    })
    await flush()
    expect(getApprovalsMock).toHaveBeenCalledTimes(2)
    expect(onError).not.toHaveBeenCalled()

    act(() => {
      currentTime = 1_999
      jest.advanceTimersByTime(499)
    })
    await flush()
    expect(getApprovalsMock).toHaveBeenCalledTimes(2)
    act(() => {
      currentTime = 2_000
      jest.advanceTimersByTime(1)
    })
    await flush()

    expect(getApprovalsMock).toHaveBeenCalledTimes(3)
    expect(latest().approvals).toEqual([
      expect.objectContaining({id: item.id, state: 'pending'}),
    ])
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports a snapshot failure only after three attempts', async () => {
    getApprovalsMock.mockRejectedValue(new Error('offline'))

    const {onError} = renderHook('session-a')
    await flush()
    act(() => {
      currentTime = 1_500
      jest.advanceTimersByTime(500)
    })
    await flush()
    act(() => {
      currentTime = 2_000
      jest.advanceTimersByTime(500)
    })
    await flush()

    expect(getApprovalsMock).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      '승인 목록을 불러오지 못했습니다.'
    )
  })

  it('keeps retry attempts on absolute offsets after slow failures', async () => {
    const first = deferred<OpenClawApprovalSnapshotDTO>()
    const second = deferred<OpenClawApprovalSnapshotDTO>()
    getApprovalsMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValueOnce(completeSnapshot())
    renderHook('session-a')

    currentTime = 1_400
    first.reject(new Error('slow first failure'))
    await flush()
    act(() => {
      currentTime = 1_499
      jest.advanceTimersByTime(99)
    })
    await flush()
    expect(getApprovalsMock).toHaveBeenCalledTimes(1)
    act(() => {
      currentTime = 1_500
      jest.advanceTimersByTime(1)
    })
    await flush()
    expect(getApprovalsMock).toHaveBeenCalledTimes(2)

    currentTime = 1_900
    second.reject(new Error('slow second failure'))
    await flush()
    act(() => {
      currentTime = 1_999
      jest.advanceTimersByTime(99)
    })
    await flush()
    expect(getApprovalsMock).toHaveBeenCalledTimes(2)
    act(() => {
      currentTime = 2_000
      jest.advanceTimersByTime(1)
    })
    await flush()
    expect(getApprovalsMock).toHaveBeenCalledTimes(3)
  })

  it('cancels a pending snapshot retry when the session changes', async () => {
    let firstSignal: AbortSignal | undefined
    getApprovalsMock
      .mockImplementationOnce((_sessionId, signal) => {
        firstSignal = signal
        return Promise.reject(new Error('offline'))
      })
      .mockResolvedValueOnce(completeSnapshot())
    const {wrapper, onError} = renderHook('session-a')
    await flush()

    act(() => {
      wrapper.setProps({sessionId: 'session-b'})
    })
    await flush()
    act(() => {
      jest.advanceTimersByTime(1_500)
    })
    await flush()

    expect(firstSignal?.aborted).toBe(true)
    expect(getApprovalsMock).toHaveBeenCalledTimes(2)
    expect(getApprovalsMock).toHaveBeenLastCalledWith(
      'session-b',
      expect.any(AbortSignal)
    )
    expect(onError).not.toHaveBeenCalled()
  })

  it('removes stale pending approvals after an authoritative empty recovery snapshot', async () => {
    const stale = approval('stale')
    getApprovalsMock.mockResolvedValueOnce(completeSnapshot([stale]))
    const {latest} = renderHook('session-a')
    await flush()
    expect(latest().approvals.map(item => item.id)).toEqual(['stale'])

    getApprovalsMock.mockResolvedValueOnce(completeSnapshot())
    await act(async () => {
      await latest().refreshApprovals()
    })

    expect(latest().approvals).toEqual([])
  })

  it('keeps native pending approvals when only the managed snapshot source is complete', async () => {
    const native = approval('native')
    const managed: OpenClawApprovalDTO = {
      ...approval('managed'),
      source: 'managed',
    }
    getApprovalsMock.mockResolvedValueOnce(completeSnapshot([native, managed]))
    const {latest} = renderHook('session-a')
    await flush()

    getApprovalsMock.mockResolvedValueOnce({
      approvals: [],
      completeSources: ['managed'],
    })
    await act(async () => {
      await latest().refreshApprovals()
    })

    expect(latest().approvals).toEqual([
      expect.objectContaining({id: native.id, source: 'native'}),
    ])
  })

  it('preserves a requested event received while an empty snapshot is in flight', async () => {
    const stale = approval('stale')
    const requestedDuringSnapshot = approval('requested-during-snapshot', 1_100)
    getApprovalsMock.mockResolvedValueOnce(completeSnapshot([stale]))
    const {latest} = renderHook('session-a')
    await flush()
    const recovery = deferred<OpenClawApprovalSnapshotDTO>()
    getApprovalsMock.mockReturnValueOnce(recovery.promise)

    let refresh!: Promise<void>
    act(() => {
      refresh = latest().refreshApprovals()
    })
    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.requested',
        sessionId: 'session-a',
        approval: requestedDuringSnapshot,
      })
    })
    recovery.resolve(completeSnapshot())
    await act(async () => {
      await refresh
    })

    expect(latest().approvals).toEqual([
      expect.objectContaining({id: requestedDuringSnapshot.id}),
    ])
  })

  it('aborts a switched session snapshot and ignores its late result', async () => {
    const first = deferred<OpenClawApprovalSnapshotDTO>()
    const second = deferred<OpenClawApprovalSnapshotDTO>()
    const revisited = deferred<OpenClawApprovalSnapshotDTO>()
    let firstSignal: AbortSignal | undefined
    let secondSignal: AbortSignal | undefined
    getApprovalsMock
      .mockImplementationOnce((_sessionId, signal) => {
        firstSignal = signal
        return first.promise
      })
      .mockImplementationOnce((_sessionId, signal) => {
        secondSignal = signal
        return second.promise
      })
      .mockImplementationOnce(() => revisited.promise)
    const onError = jest.fn()
    const {wrapper, latest} = renderHook('session-a', onError)

    act(() => {
      wrapper.setProps({sessionId: 'session-b'})
    })
    expect(firstSignal?.aborted).toBe(true)

    second.resolve(completeSnapshot([approval('approval-b')]))
    await flush()
    first.resolve(completeSnapshot([approval('stale-approval-a')]))
    await flush()

    expect(secondSignal?.aborted).toBe(false)
    expect(latest().approvals.map(item => item.id)).toEqual(['approval-b'])
    expect(onError).not.toHaveBeenCalled()

    act(() => {
      wrapper.setProps({sessionId: 'session-a'})
    })
    expect(latest().approvals).toEqual([])
    expect(getApprovalsMock).toHaveBeenNthCalledWith(
      3,
      'session-a',
      expect.any(AbortSignal)
    )
  })

  it('does not report a stale snapshot failure after switching sessions', async () => {
    const first = deferred<OpenClawApprovalSnapshotDTO>()
    const second = deferred<OpenClawApprovalSnapshotDTO>()
    getApprovalsMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const onError = jest.fn()
    const {wrapper} = renderHook('session-a', onError)

    act(() => {
      wrapper.setProps({sessionId: 'session-b'})
    })
    second.resolve(completeSnapshot())
    await flush()
    first.reject(new Error('stale failure'))
    await flush()

    expect(getApprovalsMock).toHaveBeenCalledTimes(2)
    expect(onError).not.toHaveBeenCalled()
  })

  it('merges requested and resolved WebSocket events with an in-flight snapshot', async () => {
    const snapshot = deferred<OpenClawApprovalSnapshotDTO>()
    const item = approval('approval-a')
    getApprovalsMock.mockReturnValueOnce(snapshot.promise)
    const {latest} = renderHook('session-a')

    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.requested',
        sessionId: 'session-a',
        approval: item,
      })
    })
    snapshot.resolve(completeSnapshot([item]))
    await flush()

    expect(latest().approvals).toEqual([
      expect.objectContaining({id: item.id, state: 'pending'}),
    ])

    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.resolved',
        sessionId: 'session-a',
        approval: {...item, decision: 'deny', resolvedAt: 1_200},
      })
    })

    expect(latest().approvals).toEqual([
      expect.objectContaining({
        id: item.id,
        state: 'denied',
        decision: 'deny',
        resolvedAt: 1_200,
      }),
    ])
  })

  it('applies a native partial resolved event without losing snapshot metadata', async () => {
    const item = approval('plugin:partial')
    getApprovalsMock.mockResolvedValueOnce(completeSnapshot([item]))
    const {latest} = renderHook('session-a')
    await flush()

    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.resolved',
        sessionId: 'session-a',
        approval: {
          id: item.id,
          source: 'native',
          decision: 'deny',
          resolvedAt: 1_200,
        },
      })
    })

    expect(latest().approvals).toEqual([
      {
        ...item,
        state: 'denied',
        decision: 'deny',
        resolvedAt: 1_200,
      },
    ])
  })

  it('issues one resolve request for two immediate calls', async () => {
    const request = deferred<void>()
    const item = approval('approval-a')
    resolveApprovalMock.mockReturnValueOnce(request.promise)
    const {latest} = renderHook('session-a')
    await flush()
    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.requested',
        sessionId: 'session-a',
        approval: item,
      })
    })

    let firstRequest!: Promise<void>
    act(() => {
      firstRequest = latest().resolveApproval(item.id, 'allow-once')
      void latest().resolveApproval(item.id, 'allow-once')
    })

    expect(resolveApprovalMock).toHaveBeenCalledTimes(1)
    expect(resolveApprovalMock).toHaveBeenCalledWith(
      'session-a',
      item.id,
      'allow-once'
    )
    expect(latest().approvals[0].state).toBe('resolving')

    request.resolve()
    await act(async () => {
      await firstRequest
    })
    expect(latest().approvals[0]).toMatchObject({
      state: 'allowed',
      decision: 'allow-once',
      resolvedAt: 1_000,
    })
  })

  it('restores pending state and reports a resolve HTTP failure', async () => {
    const item = approval('approval-a')
    const {latest, onError} = renderHook('session-a')
    await flush()
    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.requested',
        sessionId: 'session-a',
        approval: item,
      })
    })
    resolveApprovalMock.mockRejectedValueOnce(new Error('offline'))

    await act(async () => {
      await latest().resolveApproval(item.id, 'deny')
    })

    expect(latest().approvals[0].state).toBe('pending')
    expect(onError).toHaveBeenCalledWith('승인 요청을 처리하지 못했습니다.')
  })

  it.each([404, 409])(
    'keeps actions disabled and reconciles after a resolve %s conflict',
    async status => {
      const item = approval('approval-a')
      const recovery = deferred<OpenClawApprovalSnapshotDTO>()
      const {latest, onError} = renderHook('session-a')
      await flush()
      act(() => {
        latest().handleApprovalEvent({
          type: 'approval.requested',
          sessionId: 'session-a',
          approval: item,
        })
      })
      resolveApprovalMock.mockRejectedValueOnce(
        new OpenClawAPIError('resolution conflict', status)
      )
      getApprovalsMock.mockReturnValueOnce(recovery.promise)

      let resolution!: Promise<void>
      act(() => {
        resolution = latest().resolveApproval(item.id, 'deny')
      })
      await flush()

      expect(latest().approvals[0].state).toBe('resolving')
      recovery.resolve(completeSnapshot())
      await act(async () => {
        await resolution
      })

      expect(latest().approvals).toEqual([])
      expect(onError).not.toHaveBeenCalled()
    }
  )

  it('does not let a stale session conflict abort the active session snapshot', async () => {
    const item = approval('approval-a')
    const resolutionRequest = deferred<void>()
    const sessionBSnapshot = deferred<OpenClawApprovalSnapshotDTO>()
    let sessionBSignal: AbortSignal | undefined
    resolveApprovalMock.mockReturnValueOnce(resolutionRequest.promise)
    const {wrapper, latest} = renderHook('session-a')
    await flush()
    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.requested',
        sessionId: 'session-a',
        approval: item,
      })
    })

    let resolution!: Promise<void>
    act(() => {
      resolution = latest().resolveApproval(item.id, 'deny')
    })
    getApprovalsMock.mockImplementationOnce((_sessionId, signal) => {
      sessionBSignal = signal
      return sessionBSnapshot.promise
    })
    act(() => {
      wrapper.setProps({sessionId: 'session-b'})
    })

    resolutionRequest.reject(new OpenClawAPIError('conflict', 409))
    await act(async () => {
      await resolution
    })

    expect(sessionBSignal?.aborted).toBe(false)
    expect(getApprovalsMock).toHaveBeenCalledTimes(2)
    expect(getApprovalsMock).toHaveBeenLastCalledWith(
      'session-b',
      sessionBSignal
    )
    sessionBSnapshot.resolve(completeSnapshot())
    await flush()
  })

  it('expires immediately when a resolve request fails after the deadline', async () => {
    const item = approval('approval-a', 1_000, 1_500)
    const request = deferred<void>()
    resolveApprovalMock.mockReturnValueOnce(request.promise)
    const {latest, onError} = renderHook('session-a')
    await flush()
    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.requested',
        sessionId: 'session-a',
        approval: item,
      })
    })

    let resolution!: Promise<void>
    act(() => {
      resolution = latest().resolveApproval(item.id, 'deny')
    })
    currentTime = 2_000
    request.reject(new Error('offline after expiry'))
    await act(async () => {
      await resolution
    })

    expect(latest().approvals[0].state).toBe('expired')
    expect(latest().now).toBe(1_000)
    expect(onError).toHaveBeenCalledWith('승인 요청을 처리하지 못했습니다.')
  })

  it('does not regress a terminal WebSocket state when the HTTP request fails later', async () => {
    const request = deferred<void>()
    const item = approval('approval-a')
    resolveApprovalMock.mockReturnValueOnce(request.promise)
    const {latest, onError} = renderHook('session-a')
    await flush()
    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.requested',
        sessionId: 'session-a',
        approval: item,
      })
    })

    let resolution!: Promise<void>
    act(() => {
      resolution = latest().resolveApproval(item.id, 'allow-once')
    })
    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.resolved',
        sessionId: 'session-a',
        approval: {...item, decision: 'deny', resolvedAt: 1_100},
      })
    })

    request.reject(new Error('late failure'))
    await act(async () => {
      await resolution
    })

    expect(latest().approvals[0]).toMatchObject({
      state: 'denied',
      decision: 'deny',
      resolvedAt: 1_100,
    })
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('keeps the WebSocket terminal result when the HTTP request succeeds later', async () => {
    const request = deferred<void>()
    const item = approval('approval-a')
    resolveApprovalMock.mockReturnValueOnce(request.promise)
    const {latest} = renderHook('session-a')
    await flush()
    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.requested',
        sessionId: 'session-a',
        approval: item,
      })
    })

    let resolution!: Promise<void>
    act(() => {
      resolution = latest().resolveApproval(item.id, 'allow-once')
    })
    act(() => {
      latest().handleApprovalEvent({
        type: 'approval.resolved',
        sessionId: 'session-a',
        approval: {...item, decision: 'allow-once', resolvedAt: 1_100},
      })
    })

    currentTime = 1_300
    request.resolve()
    await act(async () => {
      await resolution
    })

    expect(latest().approvals[0]).toMatchObject({
      state: 'allowed',
      decision: 'allow-once',
      resolvedAt: 1_100,
    })
  })

  it('does not refetch or recreate callbacks when onError changes on a clock rerender', () => {
    const snapshot = deferred<OpenClawApprovalSnapshotDTO>()
    getApprovalsMock.mockReturnValue(snapshot.promise)
    let value!: HookValue
    let wrapper!: ReactWrapper<HarnessProps>
    act(() => {
      wrapper = mount(
        <UnstableOnErrorHarness
          sessionId="session-a"
          onValue={nextValue => {
            value = nextValue
          }}
          onError={jest.fn()}
        />
      )
    })
    wrappers.push(wrapper)
    const callbacks = {
      refreshApprovals: value.refreshApprovals,
      handleApprovalEvent: value.handleApprovalEvent,
      resolveApproval: value.resolveApproval,
    }

    currentTime = 2_000
    act(() => {
      jest.advanceTimersByTime(1_000)
    })

    expect(getApprovalsMock).toHaveBeenCalledTimes(1)
    expect(value.refreshApprovals).toBe(callbacks.refreshApprovals)
    expect(value.handleApprovalEvent).toBe(callbacks.handleApprovalEvent)
    expect(value.resolveApproval).toBe(callbacks.resolveApproval)
  })

  it('advances one local clock, expires approvals, and keeps callbacks stable', async () => {
    const item = approval('approval-a', 1_000, 2_500)
    getApprovalsMock.mockResolvedValueOnce(completeSnapshot([item]))
    const {latest} = renderHook('session-a')
    await flush()
    const callbacks = {
      refreshApprovals: latest().refreshApprovals,
      handleApprovalEvent: latest().handleApprovalEvent,
      resolveApproval: latest().resolveApproval,
    }

    currentTime = 2_000
    act(() => {
      jest.advanceTimersByTime(1_000)
    })
    expect(latest().now).toBe(2_000)
    expect(latest().approvals[0].state).toBe('pending')

    currentTime = 3_000
    act(() => {
      jest.advanceTimersByTime(1_000)
    })
    expect(latest().now).toBe(3_000)
    expect(latest().approvals[0].state).toBe('expired')
    expect(getApprovalsMock).toHaveBeenCalledTimes(1)
    expect(latest().refreshApprovals).toBe(callbacks.refreshApprovals)
    expect(latest().handleApprovalEvent).toBe(callbacks.handleApprovalEvent)
    expect(latest().resolveApproval).toBe(callbacks.resolveApproval)
  })
})
