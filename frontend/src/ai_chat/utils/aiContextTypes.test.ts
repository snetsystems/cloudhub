import {describeAiContext} from 'src/ai_chat/utils/aiContextRegistry'
// Registration is an import side effect; this import is what arms the registry.
import 'src/ai_chat/utils/aiContextTypes'
import {AiContextCapsule} from 'src/types/aiChatContext'

const serverCapsule = (payload: Record<string, any>): AiContextCapsule => ({
  id: 'host:web-01',
  type: 'server',
  sourcePage: 'server-list',
  title: 'web-01',
  summary: 'CPU 94%, MEM 62%',
  payload,
  capturedAt: 0,
})

describe('server context sent to the agent', () => {
  it('sends only the host name, never a measurement that goes stale', () => {
    const described = describeAiContext(
      serverCapsule({
        name: 'web-01',
        ip: '10.20.2.11',
        status: 'danger',
        cpu: 94.2,
        memory: 61.5,
        disk: 71.1,
      })
    )

    expect(described).toBe('web-01')
    expect(described).not.toMatch(/94|61|71|danger/)
  })

  it('withholds the IP, which is known only for hosts that run a salt minion', () => {
    // Absent here would read as "this host has no address" rather than
    // "CloudHub has no record of one", so it is never sent either way.
    expect(
      describeAiContext(serverCapsule({name: 'web-01', ip: '10.20.2.11'}))
    ).toBe('web-01')
    expect(describeAiContext(serverCapsule({name: 'web-02'}))).toBe('web-02')
  })
})

const connectionCapsule = (payload: Record<string, any>): AiContextCapsule => ({
  id: 'hubble-edge:wl:demo/frontend|wl:demo/backend',
  type: 'k8s-connection',
  sourcePage: 'traffic-map',
  title: 'demo/frontend → demo/backend',
  summary: '398 denied / 497 flows',
  payload,
  capturedAt: 0,
})

describe('k8s connection context sent to the agent', () => {
  const denied = {
    source: {
      name: 'demo/frontend',
      kind: 'workload',
      namespace: 'demo',
      workload: 'frontend',
    },
    destination: {
      name: 'demo/backend',
      kind: 'workload',
      namespace: 'demo',
      workload: 'backend',
    },
    flowCount: 497,
    denied: 398,
    policyDenied: 398,
    infraDropped: 0,
    denyReasons: [{name: 'POLICY_DENIED', count: 398}],
    deniedPolicies: [
      {
        name: 'allow-frontend-to-backend',
        namespace: 'demo',
        kind: 'NetworkPolicy',
        count: 398,
      },
    ],
  }

  it('sends the flow evidence the Kubernetes API cannot supply', () => {
    const described = describeAiContext(connectionCapsule(denied))

    expect(described).toContain('demo/frontend → demo/backend')
    expect(described).toContain('POLICY_DENIED(398)')
    expect(described).toContain('allow-frontend-to-backend')
  })

  it('keeps the policy and infrastructure split visible', () => {
    const described = describeAiContext(
      connectionCapsule({
        ...denied,
        denied: 10,
        policyDenied: 6,
        infraDropped: 4,
      })
    )

    expect(described).toContain('정책 차단 6, 인프라 드롭 4')
  })

  it('names an external peer without claiming a namespace for it', () => {
    const described = describeAiContext(
      connectionCapsule({
        ...denied,
        source: {name: 'unknown', kind: 'external'},
      })
    )

    expect(described).toContain('unknown → demo/backend')
    expect(described).not.toContain('출발 네임스페이스')
  })
})
