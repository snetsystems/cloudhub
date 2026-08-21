import {
  activeSessionApprovals,
  openClawApprovalReducer,
} from './openclawApprovalState'
import {OpenClawApprovalDTO} from 'src/ai_chat/apis/openclawApi'

const approval = (
  id: string,
  createdAt = 100,
  expiresAt = 200,
  source: OpenClawApprovalDTO['source'] = 'native'
): OpenClawApprovalDTO => ({
  id,
  source,
  title: `Approval ${id}`,
  description: 'Needs a decision',
  severity: 'high',
  toolName: 'shell',
  allowedDecisions: ['allow-once', 'deny'],
  createdAt,
  expiresAt,
})

describe('OpenClaw approval state', () => {
  it('deduplicates requested and snapshot records in timeline order', () => {
    const requested = approval('second', 10)
    const first = approval('first', 10)
    const withRequested = openClawApprovalReducer({}, {
      type: 'requested',
      sessionId: 'session-a',
      approval: requested,
      now: 20,
    })
    const withSnapshot = openClawApprovalReducer(withRequested, {
      type: 'snapshot',
      sessionId: 'session-a',
      approvals: [requested, first],
      completeSources: ['managed', 'native'],
      baseline: withRequested['session-a'],
      now: 20,
    })

    expect(activeSessionApprovals(withSnapshot, 'session-a').map(item => item.id)).toEqual([
      'first',
      'second',
    ])
  })

  it('removes pre-snapshot pending approvals omitted by an authoritative empty snapshot', () => {
    const nativePending = approval('native-pending')
    const managedPending = approval('managed-pending', 101, 201, 'managed')
    const terminal = approval('terminal')
    let beforeSnapshot = openClawApprovalReducer({}, {
      type: 'requested',
      sessionId: 'session-a',
      approval: nativePending,
      now: 100,
    })
    beforeSnapshot = openClawApprovalReducer(beforeSnapshot, {
      type: 'requested',
      sessionId: 'session-a',
      approval: managedPending,
      now: 100,
    })
    beforeSnapshot = openClawApprovalReducer(beforeSnapshot, {
      type: 'resolved',
      sessionId: 'session-a',
      approval: {...terminal, decision: 'deny', resolvedAt: 110},
    })

    const afterSnapshot = openClawApprovalReducer(beforeSnapshot, {
      type: 'snapshot',
      sessionId: 'session-a',
      approvals: [],
      completeSources: ['managed', 'native'],
      baseline: beforeSnapshot['session-a'],
      now: 120,
    })

    expect(activeSessionApprovals(afterSnapshot, 'session-a')).toEqual([
      expect.objectContaining({id: terminal.id, state: 'denied'}),
    ])
  })

  it('reconciles managed omissions without removing native approvals from a partial snapshot', () => {
    const nativePending = approval('native-pending')
    const managedPending = approval('managed-pending', 101, 201, 'managed')
    let beforeSnapshot = openClawApprovalReducer({}, {
      type: 'requested',
      sessionId: 'session-a',
      approval: nativePending,
      now: 100,
    })
    beforeSnapshot = openClawApprovalReducer(beforeSnapshot, {
      type: 'requested',
      sessionId: 'session-a',
      approval: managedPending,
      now: 100,
    })

    const afterSnapshot = openClawApprovalReducer(beforeSnapshot, {
      type: 'snapshot',
      sessionId: 'session-a',
      approvals: [],
      completeSources: ['managed'],
      baseline: beforeSnapshot['session-a'],
      now: 120,
    })

    expect(activeSessionApprovals(afterSnapshot, 'session-a')).toEqual([
      expect.objectContaining({id: nativePending.id, state: 'pending'}),
    ])
  })

  it('preserves requested events received after an authoritative snapshot began', () => {
    const stale = approval('stale')
    const requestedDuringSnapshot = approval('requested-during-snapshot', 110)
    const beforeSnapshot = openClawApprovalReducer({}, {
      type: 'requested',
      sessionId: 'session-a',
      approval: stale,
      now: 100,
    })
    const baseline = beforeSnapshot['session-a']
    const eventState = openClawApprovalReducer(beforeSnapshot, {
      type: 'requested',
      sessionId: 'session-a',
      approval: requestedDuringSnapshot,
      now: 110,
    })

    const afterSnapshot = openClawApprovalReducer(eventState, {
      type: 'snapshot',
      sessionId: 'session-a',
      approvals: [],
      completeSources: ['managed', 'native'],
      baseline,
      now: 120,
    })

    expect(activeSessionApprovals(afterSnapshot, 'session-a')).toEqual([
      expect.objectContaining({
        id: requestedDuringSnapshot.id,
        state: 'pending',
      }),
    ])
  })

  it('does not regress a resolving approval when a stale snapshot arrives', () => {
    const item = approval('approval-1')
    const pending = openClawApprovalReducer({}, {
      type: 'snapshot',
      sessionId: 'session-a',
      approvals: [item],
      completeSources: ['managed', 'native'],
      baseline: {},
      now: 100,
    })
    const resolving = openClawApprovalReducer(pending, {
      type: 'resolving',
      sessionId: 'session-a',
      approvalId: item.id,
    })
    const afterStaleSnapshot = openClawApprovalReducer(resolving, {
      type: 'snapshot',
      sessionId: 'session-a',
      approvals: [item],
      completeSources: ['managed', 'native'],
      baseline: resolving['session-a'],
      now: 101,
    })

    expect(activeSessionApprovals(afterStaleSnapshot, 'session-a')[0].state).toBe('resolving')
  })

  it('removes a baseline resolving approval omitted by an authoritative snapshot', () => {
    const item = approval('approval-1')
    const pending = openClawApprovalReducer({}, {
      type: 'requested',
      sessionId: 'session-a',
      approval: item,
      now: 100,
    })
    const resolving = openClawApprovalReducer(pending, {
      type: 'resolving',
      sessionId: 'session-a',
      approvalId: item.id,
    })

    const reconciled = openClawApprovalReducer(resolving, {
      type: 'snapshot',
      sessionId: 'session-a',
      approvals: [],
      completeSources: ['managed', 'native'],
      baseline: resolving['session-a'],
      now: 101,
    })

    expect(activeSessionApprovals(reconciled, 'session-a')).toEqual([])
  })

  it('preserves a terminal WebSocket resolution across stale snapshot and requested events', () => {
    const item = approval('approval-1')
    const resolved = openClawApprovalReducer({}, {
      type: 'resolved',
      sessionId: 'session-a',
      approval: {...item, decision: 'deny', resolvedAt: 110},
    })
    const afterStaleEvents = openClawApprovalReducer(
      openClawApprovalReducer(resolved, {
        type: 'snapshot',
        sessionId: 'session-a',
        approvals: [item],
        completeSources: ['managed', 'native'],
        baseline: resolved['session-a'],
        now: 111,
      }),
      {
        type: 'requested',
        sessionId: 'session-a',
        approval: item,
        now: 111,
      }
    )

    expect(activeSessionApprovals(afterStaleEvents, 'session-a')[0]).toMatchObject({
      state: 'denied',
      decision: 'deny',
      resolvedAt: 110,
    })
  })

  it('preserves existing display metadata when a native resolved event is partial', () => {
    const item = approval('plugin:partial')
    const pending = openClawApprovalReducer({}, {
      type: 'requested',
      sessionId: 'session-a',
      approval: item,
      now: 100,
    })

    const resolved = openClawApprovalReducer(pending, {
      type: 'resolved',
      sessionId: 'session-a',
      approval: {
        id: item.id,
        source: 'native',
        decision: 'deny',
        resolvedAt: 110,
      },
    })

    expect(activeSessionApprovals(resolved, 'session-a')[0]).toEqual({
      ...item,
      state: 'denied',
      decision: 'deny',
      resolvedAt: 110,
    })
  })

  it('ignores a partial resolved event when no displayable approval exists', () => {
    const state = openClawApprovalReducer({}, {
      type: 'resolved',
      sessionId: 'session-a',
      approval: {
        id: 'plugin:orphan',
        source: 'native',
        decision: 'allow-once',
        resolvedAt: 110,
      },
    })

    expect(activeSessionApprovals(state, 'session-a')).toEqual([])
  })

  it('moves a pending approval through resolving and allowed states', () => {
    const item = approval('approval-1')
    const pending = openClawApprovalReducer({}, {
      type: 'requested',
      sessionId: 'session-a',
      approval: item,
      now: 100,
    })
    const resolving = openClawApprovalReducer(pending, {
      type: 'resolving',
      sessionId: 'session-a',
      approvalId: item.id,
    })
    const resolved = openClawApprovalReducer(resolving, {
      type: 'resolved',
      sessionId: 'session-a',
      approval: {...item, decision: 'allow-once', resolvedAt: 105},
    })

    expect(activeSessionApprovals(resolving, 'session-a')[0].state).toBe('resolving')
    expect(activeSessionApprovals(resolved, 'session-a')[0]).toMatchObject({
      state: 'allowed',
      decision: 'allow-once',
      resolvedAt: 105,
    })
  })

  it('returns only a still-resolving approval to pending after resolution fails', () => {
    const item = approval('approval-1')
    const resolving = openClawApprovalReducer(
      openClawApprovalReducer({}, {
        type: 'requested',
        sessionId: 'session-a',
        approval: item,
        now: 100,
      }),
      {type: 'resolving', sessionId: 'session-a', approvalId: item.id}
    )
    const afterFailure = openClawApprovalReducer(resolving, {
      type: 'resolveFailed',
      sessionId: 'session-a',
      approvalId: item.id,
      now: 101,
    })

    expect(activeSessionApprovals(afterFailure, 'session-a')[0].state).toBe('pending')
  })

  it('expires a resolving approval immediately when resolution fails after its deadline', () => {
    const item = approval('approval-1', 100, 105)
    const resolving = openClawApprovalReducer(
      openClawApprovalReducer({}, {
        type: 'requested',
        sessionId: 'session-a',
        approval: item,
        now: 100,
      }),
      {type: 'resolving', sessionId: 'session-a', approvalId: item.id}
    )

    const afterFailure = openClawApprovalReducer(resolving, {
      type: 'resolveFailed',
      sessionId: 'session-a',
      approvalId: item.id,
      now: 106,
    })

    expect(activeSessionApprovals(afterFailure, 'session-a')[0].state).toBe(
      'expired'
    )
  })

  it('does not regress a WebSocket terminal state when the REST resolution fails later', () => {
    const item = approval('approval-1')
    const resolving = openClawApprovalReducer(
      openClawApprovalReducer({}, {
        type: 'requested',
        sessionId: 'session-a',
        approval: item,
        now: 100,
      }),
      {type: 'resolving', sessionId: 'session-a', approvalId: item.id}
    )
    const resolvedByWebSocket = openClawApprovalReducer(resolving, {
      type: 'resolved',
      sessionId: 'session-a',
      approval: {...item, decision: 'deny', resolvedAt: 105},
    })
    const afterRestFailure = openClawApprovalReducer(resolvedByWebSocket, {
      type: 'resolveFailed',
      sessionId: 'session-a',
      approvalId: item.id,
      now: 106,
    })

    expect(activeSessionApprovals(afterRestFailure, 'session-a')[0]).toMatchObject({
      state: 'denied',
      decision: 'deny',
    })
  })

  it('marks records expired and retains expired records for display', () => {
    const active = approval('active', 100, 200)
    const expired = approval('expired', 100, 150)
    const state = openClawApprovalReducer({}, {
      type: 'snapshot',
      sessionId: 'session-a',
      approvals: [active, expired],
      completeSources: ['managed', 'native'],
      baseline: {},
      now: 150,
    })
    const expiredState = openClawApprovalReducer(state, {
      type: 'expire',
      sessionId: 'session-a',
      now: 200,
    })
    const requestedExpired = openClawApprovalReducer(expiredState, {
      type: 'requested',
      sessionId: 'session-a',
      approval: expired,
      now: 200,
    })

    expect(activeSessionApprovals(state, 'session-a')).toEqual([
      expect.objectContaining({id: 'active', state: 'pending'}),
      expect.objectContaining({id: 'expired', state: 'expired'}),
    ])
    expect(activeSessionApprovals(requestedExpired, 'session-a')).toEqual([
      expect.objectContaining({id: 'active', state: 'expired'}),
      expect.objectContaining({id: 'expired', state: 'expired'}),
    ])
  })

  it('keeps approvals isolated by session', () => {
    const state = openClawApprovalReducer({}, {
      type: 'requested',
      sessionId: 'session-a',
      approval: approval('approval-a'),
      now: 100,
    })
    const withSecondSession = openClawApprovalReducer(state, {
      type: 'requested',
      sessionId: 'session-b',
      approval: approval('approval-b'),
      now: 100,
    })
    const resolvedFirstSession = openClawApprovalReducer(withSecondSession, {
      type: 'resolved',
      sessionId: 'session-a',
      approval: {...approval('approval-a'), decision: 'deny', resolvedAt: 105},
    })

    expect(activeSessionApprovals(resolvedFirstSession, 'session-a')[0].state).toBe('denied')
    expect(activeSessionApprovals(resolvedFirstSession, 'session-b')).toEqual([
      expect.objectContaining({id: 'approval-b', state: 'pending'}),
    ])
  })
})
