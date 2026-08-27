import {
  getOpenClawApprovals,
  getOpenClawSessions,
  openClawUrl,
  OpenClawApprovalEventDTO,
  resolveOpenClawApproval,
  sendOpenClawMessage,
} from './openclawApi'

describe('OpenClaw request addressing', () => {
  const fetchMock = jest.fn()
  const originalBasepath = window.basepath

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = (fetchMock as unknown) as typeof fetch
  })

  afterEach(() => {
    window.basepath = originalBasepath
  })

  it('mounts requests under the basepath the server was started with', async () => {
    window.basepath = '/cloudhub'
    fetchMock.mockResolvedValue({ok: true, json: async () => ({sessions: []})})

    await getOpenClawSessions()

    expect(fetchMock).toHaveBeenCalledWith(
      '/cloudhub/cloudhub/v2/openclaw/sessions',
      expect.anything()
    )
  })

  it('reads the basepath per call, since bootstrap assigns it after this module loads', () => {
    window.basepath = undefined
    expect(openClawUrl('/events/ws')).toBe('/cloudhub/v2/openclaw/events/ws')

    window.basepath = '/cloudhub'
    expect(openClawUrl('/events/ws')).toBe(
      '/cloudhub/cloudhub/v2/openclaw/events/ws'
    )
  })

  it('sends the session credentials the API authorizes the caller with', async () => {
    fetchMock.mockResolvedValue({ok: true})

    await sendOpenClawMessage('session/one', 'hello', 'idem-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/cloudhub/v2/openclaw/sessions/session%2Fone/messages',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({message: 'hello', idempotencyKey: 'idem-1'}),
      })
    )
  })
})

describe('OpenClaw approval API', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = (fetchMock as unknown) as typeof fetch
  })

  it('encodes the session ID, passes the abort signal, and returns an authoritative empty snapshot', async () => {
    const signal = new AbortController().signal
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        approvals: [],
        completeSources: ['managed', 'native'],
      }),
    })

    await expect(getOpenClawApprovals('session/one', signal)).resolves.toEqual({
      approvals: [],
      completeSources: ['managed', 'native'],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/cloudhub/v2/openclaw/sessions/session%2Fone/approvals',
      expect.objectContaining({signal})
    )
  })

  it('preserves source-aware completeness for a partial native failure snapshot', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        approvals: [
          {
            id: 'cloudhub:approval/one',
            source: 'managed',
            title: 'Apply repair',
            description: 'Repair the network policy',
            severity: 'warning',
            toolName: 'k8s_network__repair_network_policy_port',
            allowedDecisions: ['allow-once', 'deny'],
            createdAt: 1786700000000,
            expiresAt: 1786700120000,
          },
        ],
        completeSources: ['managed'],
      }),
    })

    await expect(getOpenClawApprovals('session/one')).resolves.toEqual({
      approvals: [expect.objectContaining({source: 'managed'})],
      completeSources: ['managed'],
    })
  })

  it('returns a bounded status-only error when fetching approvals fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({message: 'secret upstream response'}),
    })

    await expect(getOpenClawApprovals('session/one')).rejects.toThrow(
      'Failed to fetch approvals (502): Bad Gateway'
    )
    await expect(getOpenClawApprovals('session/one')).rejects.not.toThrow(
      'secret upstream response'
    )
  })

  it('encodes session and approval IDs and posts the exact decision body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
    })

    await expect(
      resolveOpenClawApproval(
        'session/one',
        'cloudhub:approval/one',
        'allow-once'
      )
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      '/cloudhub/v2/openclaw/sessions/session%2Fone/approvals/cloudhub%3Aapproval%2Fone/resolve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({decision: 'allow-once'}),
      })
    )
  })

  it('does not expose an arbitrary response body when resolving fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () => 'secret upstream response',
      json: async () => ({message: 'secret upstream response'}),
    })

    await expect(
      resolveOpenClawApproval('session/one', 'cloudhub:approval/one', 'deny')
    ).rejects.toThrow('Failed to resolve approval (409): Conflict')
    await expect(
      resolveOpenClawApproval('session/one', 'cloudhub:approval/one', 'deny')
    ).rejects.not.toThrow('secret upstream response')
  })

  it('exposes the bounded HTTP status needed for conflict recovery', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
    })

    await expect(
      resolveOpenClawApproval('session/one', 'cloudhub:approval/one', 'deny')
    ).rejects.toMatchObject({
      message: 'Failed to resolve approval (409): Conflict',
      status: 409,
    })
  })

  it('models the resolver identity on resolved approval events', () => {
    const event: OpenClawApprovalEventDTO = {
      type: 'approval.resolved',
      sessionId: 'session/one',
      approval: {
        id: 'cloudhub:approval/one',
        source: 'managed',
        title: 'Apply repair',
        description: 'Repair the network policy',
        severity: 'warning',
        toolName: 'k8s_network__repair_network_policy_port',
        allowedDecisions: ['allow-once', 'deny'],
        createdAt: 1786700000000,
        expiresAt: 1786700120000,
        decision: 'allow-once',
        resolvedAt: 1786700005000,
        resolvedBy: '42',
      },
    }

    expect(event.approval.resolvedBy).toBe('42')
  })

  it('models native resolved events without requested-event display metadata', () => {
    const event: OpenClawApprovalEventDTO = {
      type: 'approval.resolved',
      sessionId: 'session/one',
      approval: {
        id: 'plugin:partial',
        source: 'native',
        decision: 'deny',
        resolvedAt: 1786700005000,
      },
    }

    expect(event.approval).toEqual({
      id: 'plugin:partial',
      source: 'native',
      decision: 'deny',
      resolvedAt: 1786700005000,
    })
  })
})
