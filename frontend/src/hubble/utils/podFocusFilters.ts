import {HubbleFlowFilters} from 'src/hubble/types'
import {PodConnectionDirection} from 'src/hubble/utils/podConnections'

// podFocusFilters scopes the bottom flow table to a single pod. The pod name
// is matched either-side through the free-text `q` param — the backend
// matches `q` against SrcPod/DstPod among other fields (server/hubble.go,
// flowContainsQuery) — so this surfaces both inbound and outbound flows for
// the pod. Returns {} for an empty name (no reliable scope).
export const podFocusFilters = (podName: string): HubbleFlowFilters =>
  podName ? {q: podName} : {}

// podPeerFilters scopes the flow table to one pod<->peer pair in a given
// direction. The pod side puts the full pod name in the workload field: the
// backend workload filter also substring-matches the pod name
// (server/hubble.go lines 491/494), so the full pod name pins the exact pod.
// The peer side uses its best stable identifier (workload preferred, else pod
// name); an IP-only / unresolved peer contributes no filter for its side
// rather than guessing — the same policy edgeDetailFilters.sideFilter uses.
export const podPeerFilters = (
  podName: string,
  peer: {peerWorkload: string; peerPod: string},
  direction: PodConnectionDirection
): HubbleFlowFilters => {
  const peerIdent = peer.peerWorkload || peer.peerPod
  if (direction === 'outbound') {
    return {
      srcWorkload: podName,
      ...(peerIdent ? {dstWorkload: peerIdent} : {}),
    }
  }
  return {
    ...(peerIdent ? {srcWorkload: peerIdent} : {}),
    dstWorkload: podName,
  }
}
