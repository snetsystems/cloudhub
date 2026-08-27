import {
  buildConnectionContextPayload,
  buildConnectionContextSummary,
} from 'src/hubble/utils/aiConnectionContext'
import {HubbleEdge} from 'src/hubble/types'

const edge: HubbleEdge = {
  src: 'wl:network-repair-demo/frontend',
  dst: 'wl:network-repair-demo/backend',
  flowCount: 497,
  verdictCounts: {FORWARDED: 99, DROPPED: 398},
  topDenyReasons: [{reason: 'POLICY_DENIED', count: 398}],
  topDeniedPolicies: [
    {
      name: 'allow-frontend-to-backend',
      namespace: 'network-repair-demo',
      kind: 'NetworkPolicy',
      count: 398,
    },
  ],
}

describe('connection row to AI context', () => {
  it('splits the node ids into namespace and workload', () => {
    const payload = buildConnectionContextPayload(edge)

    expect(payload.source).toMatchObject({
      namespace: 'network-repair-demo',
      workload: 'frontend',
      kind: 'workload',
    })
    expect(payload.destination).toMatchObject({
      namespace: 'network-repair-demo',
      workload: 'backend',
      kind: 'workload',
    })
  })

  it('carries the denial evidence the agent cannot read from the k8s API', () => {
    const payload = buildConnectionContextPayload(edge)

    expect(payload).toMatchObject({
      flowCount: 497,
      denied: 398,
      policyDenied: 398,
      infraDropped: 0,
    })
    expect(payload.denyReasons).toEqual([{name: 'POLICY_DENIED', count: 398}])
    expect(payload.deniedPolicies).toEqual([
      {
        name: 'allow-frontend-to-backend',
        namespace: 'network-repair-demo',
        kind: 'NetworkPolicy',
        count: 398,
      },
    ])
  })

  it('keeps infrastructure drops out of the policy denial count', () => {
    const noisy: HubbleEdge = {
      ...edge,
      verdictCounts: {DROPPED: 10},
      topDenyReasons: [
        {reason: 'POLICY_DENIED', count: 6},
        {reason: 'UNSUPPORTED_L3_PROTOCOL', count: 4},
      ],
    }

    const payload = buildConnectionContextPayload(noisy)

    expect(payload.policyDenied).toBe(6)
    expect(payload.infraDropped).toBe(4)
  })

  it('describes an external peer without inventing a namespace', () => {
    const external: HubbleEdge = {
      ...edge,
      src: 'ext:unknown',
    }

    const payload = buildConnectionContextPayload(external)

    expect(payload.source).toEqual({name: 'unknown', kind: 'external'})
  })

  it('names a namespace group by the namespace it stands for', () => {
    const grouped: HubbleEdge = {
      ...edge,
      dst: 'nsgrp:kube-system',
    }

    const payload = buildConnectionContextPayload(grouped)

    expect(payload.destination).toMatchObject({
      namespace: 'kube-system',
      kind: 'ns group',
    })
    expect(payload.destination.workload).toBeUndefined()
  })

  it('summarises the row for the chip', () => {
    expect(buildConnectionContextSummary(edge)).toBe('398 denied / 497 flows')
  })
})
