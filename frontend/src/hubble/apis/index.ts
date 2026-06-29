import AJAX from 'src/utils/ajax'
import {
  HubbleClustersResponse,
  HubbleEdgeFlowsResponse,
  HubbleFlowFilters,
  HubblePolicyResponse,
  HubbleSnapshot,
  HubbleSnapshotStatus,
} from 'src/hubble/types'

const BASE = '/cloudhub/v1/hubble'

export const getHubbleClusters = async (): Promise<HubbleClustersResponse> => {
  const {data} = await AJAX({url: `${BASE}/clusters`, method: 'GET'})
  return data as HubbleClustersResponse
}

export const getHubbleClusterStatus = async (
  cluster: string
): Promise<HubbleSnapshotStatus> => {
  const {data} = await AJAX({
    url: `${BASE}/clusters/${encodeURIComponent(cluster)}/status`,
    method: 'GET',
  })
  return data as HubbleSnapshotStatus
}

export const getHubbleOverviewSnapshot = async (
  cluster: string
): Promise<HubbleSnapshot> => {
  const {data} = await AJAX({
    url: `${BASE}/clusters/${encodeURIComponent(cluster)}/snapshot`,
    method: 'GET',
  })
  return data as HubbleSnapshot
}

export const getHubbleDrilldownSnapshot = async (
  cluster: string,
  namespace: string
): Promise<HubbleSnapshot> => {
  const {data} = await AJAX({
    url: `${BASE}/clusters/${encodeURIComponent(
      cluster
    )}/drilldown/${encodeURIComponent(namespace)}`,
    method: 'GET',
  })
  return data as HubbleSnapshot
}

export const getHubbleEdgeFlows = async (
  cluster: string,
  src: string,
  dst: string,
  limit = 20
): Promise<HubbleEdgeFlowsResponse> => {
  const qs = new URLSearchParams({src, dst, limit: String(limit)})
  const {data} = await AJAX({
    url: `${BASE}/clusters/${encodeURIComponent(
      cluster
    )}/flows?${qs.toString()}`,
    method: 'GET',
  })
  return data as HubbleEdgeFlowsResponse
}

// hubbleOverviewWSUrl returns the absolute ws:// URL for the overview push stream.
// The page's protocol/host is reused so dev (http→ws) and prod (https→wss) work
// without configuration.
export const hubbleOverviewWSUrl = (cluster: string): string =>
  buildWSUrl(`${BASE}/clusters/${encodeURIComponent(cluster)}/snapshot/ws`)

export const hubbleDrilldownWSUrl = (
  cluster: string,
  namespace: string
): string =>
  buildWSUrl(
    `${BASE}/clusters/${encodeURIComponent(
      cluster
    )}/drilldown/${encodeURIComponent(namespace)}/ws`
  )

export const hubbleEdgeFlowsWSUrl = (
  cluster: string,
  src: string,
  dst: string,
  limit = 20
): string => {
  const qs = new URLSearchParams({src, dst, limit: String(limit)})
  return buildWSUrl(
    `${BASE}/clusters/${encodeURIComponent(cluster)}/flows/ws?${qs.toString()}`
  )
}

export const getHubbleAllFlows = async (
  cluster: string,
  limit = 200,
  namespace?: string | null,
  filters?: HubbleFlowFilters
): Promise<HubbleEdgeFlowsResponse> => {
  const qs = new URLSearchParams({limit: String(limit)})
  if (namespace) qs.set('namespace', namespace)
  appendFlowFilters(qs, filters)
  const {data} = await AJAX({
    url: `${BASE}/clusters/${encodeURIComponent(
      cluster
    )}/flows/all?${qs.toString()}`,
    method: 'GET',
  })
  return data as HubbleEdgeFlowsResponse
}

export const hubbleAllFlowsWSUrl = (
  cluster: string,
  limit = 200,
  namespace?: string | null,
  filters?: HubbleFlowFilters
): string => {
  const qs = new URLSearchParams({limit: String(limit)})
  if (namespace) qs.set('namespace', namespace)
  appendFlowFilters(qs, filters)
  return buildWSUrl(
    `${BASE}/clusters/${encodeURIComponent(
      cluster
    )}/flows/all/ws?${qs.toString()}`
  )
}

const appendFlowFilters = (
  qs: URLSearchParams,
  filters?: HubbleFlowFilters
): void => {
  if (!filters) return
  setParam(qs, 'srcWorkload', filters.srcWorkload)
  setParam(qs, 'dstWorkload', filters.dstWorkload)
  setParam(qs, 'verdict', filters.verdict)
  setParam(qs, 'dropReason', filters.dropReason)
  setParam(qs, 'protocol', filters.protocol)
  setParam(qs, 'port', filters.port)
  setParam(qs, 'l7Type', filters.l7Type)
  setParam(qs, 'l7Query', filters.l7Query)
  setParam(qs, 'q', filters.q)
  if (filters.externalOnly) qs.set('externalOnly', 'true')
}

const setParam = (
  qs: URLSearchParams,
  name: string,
  value?: string | null
): void => {
  const trimmed = value?.trim()
  if (trimmed) qs.set(name, trimmed)
}

export const getHubblePolicy = async (
  cluster: string,
  kind: string,
  name: string,
  namespace?: string
): Promise<HubblePolicyResponse> => {
  const qs = new URLSearchParams({kind, name})
  if (namespace) qs.set('namespace', namespace)
  const {data} = await AJAX({
    url: `${BASE}/clusters/${encodeURIComponent(
      cluster
    )}/policy?${qs.toString()}`,
    method: 'GET',
  })
  return data as HubblePolicyResponse
}

const buildWSUrl = (path: string): string => {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${path}`
}
