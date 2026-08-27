import {
  mergeReasons,
  shortReasonLabel,
  splitDrops,
  windowDropSplit,
} from 'src/hubble/utils/dropReasons'
import {edgeVerdict} from 'src/hubble/utils/edgeVerdict'
import {buildNodeStats} from 'src/hubble/utils/nodeStats'
import {HubbleEdge, HubbleSnapshot} from 'src/hubble/types'

const edge = (over: Partial<HubbleEdge> = {}): HubbleEdge =>
  ({
    src: 'wl:demo/frontend',
    dst: 'wl:demo/backend',
    flowCount: 100,
    verdictCounts: {},
    ...over,
  } as HubbleEdge)

describe('splitDrops', () => {
  it('counts POLICY_DENIED as a policy denial', () => {
    const e = edge({
      verdictCounts: {DROPPED: 86},
      topDenyReasons: [{name: 'POLICY_DENIED', count: 86}],
    })
    expect(windowDropSplit(e)).toEqual({
      policy: 86,
      infra: 0,
      infraReasons: [],
    })
  })

  it('counts a datapath reason as infrastructure, not policy', () => {
    const e = edge({
      verdictCounts: {DROPPED: 1},
      topDenyReasons: [{name: 'UNSUPPORTED_L3_PROTOCOL', count: 1}],
    })
    const split = windowDropSplit(e)
    expect(split.policy).toEqual(0)
    expect(split.infra).toEqual(1)
    expect(split.infraReasons).toEqual([
      {name: 'UNSUPPORTED_L3_PROTOCOL', count: 1},
    ])
  })

  it('separates both causes on one edge', () => {
    const e = edge({
      verdictCounts: {DROPPED: 10},
      topDenyReasons: [
        {name: 'POLICY_DENIED', count: 7},
        {name: 'FRAG_NEEDED', count: 3},
      ],
    })
    const split = windowDropSplit(e)
    expect(split.policy).toEqual(7)
    expect(split.infra).toEqual(3)
  })

  it('attributes drops to policy when no reason is reported', () => {
    const e = edge({verdictCounts: {DROPPED: 4}})
    expect(windowDropSplit(e).policy).toEqual(4)
  })

  it('never reports more infra drops than the total it was given', () => {
    const e = edge({
      topDenyReasons: [{name: 'FRAG_NEEDED', count: 99}],
    })
    expect(splitDrops(e, 2)).toEqual({
      policy: 0,
      infra: 2,
      infraReasons: [{name: 'FRAG_NEEDED', count: 99}],
    })
  })

  it('returns zeroes for a total of zero', () => {
    const e = edge({topDenyReasons: [{name: 'POLICY_DENIED', count: 5}]})
    expect(splitDrops(e, 0)).toEqual({policy: 0, infra: 0, infraReasons: []})
  })
})

describe('edgeVerdict with drop reasons', () => {
  it('stays healthy when the only recent drop is infrastructure', () => {
    const e = edge({
      recentVerdictCounts: {DROPPED: 1},
      verdictCounts: {DROPPED: 1, TRACED: 448},
      topDenyReasons: [{name: 'UNSUPPORTED_L3_PROTOCOL', count: 1}],
      lastVerdict: 'DROPPED',
    })
    expect(edgeVerdict(e)).toEqual('forwarded')
  })

  it('is denied when the recent drop is a policy denial', () => {
    const e = edge({
      recentVerdictCounts: {DROPPED: 3},
      verdictCounts: {DROPPED: 3},
      topDenyReasons: [{name: 'POLICY_DENIED', count: 3}],
    })
    expect(edgeVerdict(e)).toEqual('denied')
  })

  it('does not mark an edge recovered for infrastructure drops alone', () => {
    const e = edge({
      recentVerdictCounts: {FORWARDED: 50},
      verdictCounts: {FORWARDED: 900, DROPPED: 1},
      topDenyReasons: [{name: 'UNSUPPORTED_L3_PROTOCOL', count: 1}],
    })
    expect(edgeVerdict(e)).toEqual('forwarded')
  })

  it('marks recovered when the window held a policy denial', () => {
    const e = edge({
      recentVerdictCounts: {FORWARDED: 50},
      verdictCounts: {FORWARDED: 900, DROPPED: 14},
      topDenyReasons: [{name: 'POLICY_DENIED', count: 14}],
    })
    expect(edgeVerdict(e)).toEqual('recovered')
  })
})

describe('buildNodeStats', () => {
  it('keeps infrastructure drops out of deniedFlows and records the reason', () => {
    const snapshot = {
      edges: [
        edge({
          src: 'wl:demo/frontend',
          dst: 'ext:unknown',
          verdictCounts: {DROPPED: 1, TRACED: 448},
          topDenyReasons: [{name: 'UNSUPPORTED_L3_PROTOCOL', count: 1}],
        }),
      ],
    } as HubbleSnapshot
    const stats = buildNodeStats(snapshot)
    const frontend = stats.get('wl:demo/frontend')!
    expect(frontend.deniedFlows).toEqual(0)
    expect(frontend.hadRecentDeny).toBe(false)
    expect(frontend.infraDroppedFlows).toEqual(1)
    expect(frontend.infraDropReasons).toEqual([
      {name: 'UNSUPPORTED_L3_PROTOCOL', count: 1},
    ])
  })

  it('still counts policy denials on both endpoints', () => {
    const snapshot = {
      edges: [
        edge({
          recentVerdictCounts: {DROPPED: 14},
          verdictCounts: {DROPPED: 14},
          topDenyReasons: [{name: 'POLICY_DENIED', count: 14}],
        }),
      ],
    } as HubbleSnapshot
    const stats = buildNodeStats(snapshot)
    expect(stats.get('wl:demo/frontend')!.deniedFlows).toEqual(14)
    expect(stats.get('wl:demo/backend')!.deniedFlows).toEqual(14)
    expect(stats.get('wl:demo/backend')!.infraDroppedFlows).toEqual(0)
  })
})

describe('reason presentation', () => {
  it('shortens known datapath reasons and passes others through', () => {
    expect(
      shortReasonLabel({name: 'UNSUPPORTED_L3_PROTOCOL', count: 1})
    ).toEqual('L3 미지원')
    expect(shortReasonLabel({name: 'SOMETHING_NEW', count: 1})).toEqual(
      'SOMETHING_NEW'
    )
  })

  it('merges reason counts across edges', () => {
    expect(
      mergeReasons(
        [{name: 'FRAG_NEEDED', count: 2}],
        [
          {name: 'FRAG_NEEDED', count: 3},
          {name: 'UNROUTABLE', count: 9},
        ]
      )
    ).toEqual([
      {name: 'UNROUTABLE', count: 9},
      {name: 'FRAG_NEEDED', count: 5},
    ])
  })
})
