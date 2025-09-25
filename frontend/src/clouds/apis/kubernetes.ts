// Libraries
import _ from 'lodash'

// Utils
import {getDeep} from 'src/utils/wrappers'
import replaceTemplate from 'src/tempVars/utils/replace'
import {proxy} from 'src/utils/queryUrlGenerator'

// Types
import {Template} from 'src/types'
import {KubernetesObject} from 'src/clouds/types'

interface K8sNodeSeries {
  name: string
  columns: string[]
  values: string[]
  tags: {
    node_name: string
  }
}
interface K8sPodSeries {
  name: string
  columns: string[]
  values: string[]
  tags: {
    pod_name: string
  }
}

const EmptyK8s = {
  name: '',
  type: '',
  cpu: 0.0,
  memory: 0.0,
}

export const getCpuAndLoadForK8s = async (
  proxyLink: string,
  telegrafDB: string,
  tempVars: Template[]
): Promise<KubernetesObject> => {
  const query = replaceTemplate(
    `SELECT last("cpu_usage_nanocores") / 1000000 FROM ":db:".":rp:"."kubernetes_node" WHERE time > now() - 10m GROUP BY node_name;
      SELECT last("memory_rss_bytes"), last("memory_working_set_bytes") FROM ":db:".":rp:"."kubernetes_node" WHERE time > now() - 10m GROUP BY node_name;
      SELECT last("cpu_usage_nanocores") / 1000000 FROM ":db:".":rp:"."kubernetes_pod_container" WHERE time > now() - 10m GROUP BY pod_name;
      SELECT last("memory_rss_bytes"), last("memory_working_set_bytes") FROM ":db:".":rp:"."kubernetes_pod_container" WHERE time > now() - 10m GROUP BY pod_name;
      SELECT last("userDataSdc")/1000 AS "userDataSdc" FROM ":db:".":rp:"."scaleio.volume.latency.read" WHERE time > now() - 10m GROUP BY volume_name;
      SELECT last("userDataSdc")/1000 AS "userDataSdc" FROM ":db:".":rp:"."scaleio.volume.latency.write" WHERE time > now() - 10m GROUP BY volume_name;
      SELECT last("userData") AS "userData" FROM ":db:".":rp:"."scaleio.volume.iops.read" WHERE time > now() - 10m GROUP BY volume_name;
      SELECT last("userData") AS "userData" FROM ":db:".":rp:"."scaleio.volume.iops.write" WHERE time > now() - 10m GROUP BY volume_name;
      SELECT last("userData") AS "userData" FROM ":db:".":rp:"."scaleio.volume.bw.read" WHERE time > now() - 10m GROUP BY volume_name;
      SELECT last("userData") AS "userData" FROM ":db:".":rp:"."scaleio.volume.bw.write" WHERE time > now() - 10m GROUP BY volume_name;`,
    tempVars
  )

  const {data} = await proxy({
    source: proxyLink,
    query,
    db: telegrafDB,
  })

  const k8sObject = {}
  const nodeCpuSeries = getDeep<K8sNodeSeries[]>(data, 'results.[0].series', [])
  const nodeMemorySeries = getDeep<K8sNodeSeries[]>(
    data,
    'results.[1].series',
    []
  )
  const podCpuSeries = getDeep<K8sPodSeries[]>(data, 'results.[2].series', [])
  const podMemorySeries = getDeep<K8sPodSeries[]>(
    data,
    'results.[3].series',
    []
  )
  const volLatencyReadSeries = getDeep<any[]>(data, 'results.[4].series', [])
  const volLatencyWriteSeries = getDeep<any[]>(data, 'results.[5].series', [])
  const volIopsReadSeries = getDeep<any[]>(data, 'results.[6].series', [])
  const volIopsWriteSeries = getDeep<any[]>(data, 'results.[7].series', [])
  const volBwReadSeries = getDeep<any[]>(data, 'results.[8].series', [])
  const volBwWriteSeries = getDeep<any[]>(data, 'results.[9].series', [])

  _.forEach(nodeCpuSeries, s => {
    const lastIndex = _.findIndex(s.columns, col => col === 'last')
    k8sObject[s.tags.node_name] = {
      ...EmptyK8s,
      name: s.tags.node_name,
      type: 'Node',
      cpu: Number(s.values[0][lastIndex]),
    }
  })

  _.forEach(nodeMemorySeries, s => {
    const rssIndex = _.findIndex(s.columns, col => col === 'last')
    const workingIndex = _.findIndex(s.columns, col => col === 'last_1')
    k8sObject[s.tags.node_name].memory = Math.max(
      Number(s.values[0][rssIndex]),
      Number(s.values[0][workingIndex])
    )
  })

  _.forEach(podCpuSeries, s => {
    const lastIndex = _.findIndex(s.columns, col => col === 'last')
    k8sObject[s.tags.pod_name] = {
      ...EmptyK8s,
      name: s.tags.pod_name,
      type: 'Pod',
      cpu: Number(s.values[0][lastIndex]),
    }
  })

  _.forEach(podMemorySeries, s => {
    const rssIndex = _.findIndex(s.columns, col => col === 'last')
    const workingIndex = _.findIndex(s.columns, col => col === 'last_1')
    k8sObject[s.tags.pod_name].memory = k8sObject[
      s.tags.pod_name
    ].memory = Math.max(
      Number(s.values[0][rssIndex]),
      Number(s.values[0][workingIndex])
    )
  })

  const getLastValue = (series: any) => {
    const idx = _.findIndex(
      series.columns,
      col =>
        col === 'last' ||
        col === 'mean' ||
        col === 'userData' ||
        col === 'userDataSdc'
    )
    const values = series.values || []
    const last = values.length > 0 ? values[values.length - 1] : null
    return last && idx >= 0 ? Number(last[idx]) : 0
  }

  const volumeMetrics: Record<
    string,
    {
      iopsRead?: number
      iopsWrite?: number
      bwRead?: number
      bwWrite?: number
      latRead?: number
      latWrite?: number
    }
  > = {}

  _.forEach(volIopsReadSeries, s => {
    const v = getLastValue(s)
    volumeMetrics[s.tags.volume_name] = {
      ...volumeMetrics[s.tags.volume_name],
      iopsRead: v,
    }
  })
  _.forEach(volIopsWriteSeries, s => {
    const v = getLastValue(s)
    volumeMetrics[s.tags.volume_name] = {
      ...volumeMetrics[s.tags.volume_name],
      iopsWrite: v,
    }
  })
  _.forEach(volBwReadSeries, s => {
    const v = getLastValue(s)
    volumeMetrics[s.tags.volume_name] = {
      ...volumeMetrics[s.tags.volume_name],
      bwRead: v,
    }
  })
  _.forEach(volBwWriteSeries, s => {
    const v = getLastValue(s)
    volumeMetrics[s.tags.volume_name] = {
      ...volumeMetrics[s.tags.volume_name],
      bwWrite: v,
    }
  })
  _.forEach(volLatencyReadSeries, s => {
    const v = getLastValue(s)
    volumeMetrics[s.tags.volume_name] = {
      ...volumeMetrics[s.tags.volume_name],
      latRead: v,
    }
  })
  _.forEach(volLatencyWriteSeries, s => {
    const v = getLastValue(s)
    volumeMetrics[s.tags.volume_name] = {
      ...volumeMetrics[s.tags.volume_name],
      latWrite: v,
    }
  })

  _.forEach(volumeMetrics, (vm, volName) => {
    const iops = (vm.iopsRead || 0) + (vm.iopsWrite || 0)
    const bandwidth = (vm.bwRead || 0) + (vm.bwWrite || 0)
    const r = vm.latRead || 0
    const w = vm.latWrite || 0
    const rIOPS = vm.iopsRead || 0
    const wIOPS = vm.iopsWrite || 0
    const totalIOPS = rIOPS + wIOPS
    const latency =
      totalIOPS > 0
        ? (r * rIOPS + w * wIOPS) / totalIOPS
        : _.mean([r, w].filter(v => v > 0)) || 0

    k8sObject[volName] = {
      ...EmptyK8s,
      name: volName,
      type: 'PV',
      iops,
      bandwidth,
      latency,
    }
  })

  return k8sObject
}
