// Utils
import {getDeep} from 'src/utils/wrappers'
import replaceTemplate from 'src/tempVars/utils/replace'
import {proxy} from 'src/utils/queryUrlGenerator'

// Types
import {Template} from 'src/types'
import {HostsObject} from 'src/hosts/apis'

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
): Promise<HostsObject> => {
  console.log('getCpuAndLoadForK8s')
  const query = replaceTemplate(
    `SELECT last("cpu_usage_nanocores") / 1000000 FROM \":db:\".\":rp:\".\"kubernetes_node\" WHERE time > now() - 10m GROUP BY node_name;
      SELECT last("memory_rss_bytes"), last("memory_working_set_bytes") FROM \":db:\".\":rp:\".\"kubernetes_node\" WHERE time > now() - 10m GROUP BY node_name;
      SELECT last("cpu_usage_nanocores") / 1000000 FROM \":db:\".\":rp:\".\"kubernetes_pod_container\" WHERE time > now() - 10m GROUP BY pod_name;
      SELECT last("memory_rss_bytes"), last("memory_working_set_bytes") FROM \":db:\".\":rp:\".\"kubernetes_pod_container\" WHERE time > now() - 10m GROUP BY pod_name;`,
    tempVars
  )
  console.log(query)
  const {data} = await proxy({
    source: proxyLink,
    query,
    db: telegrafDB,
  })
  console.log(data)
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
  nodeCpuSeries.forEach(s => {
    const lastIndex = s.columns.findIndex(col => col === 'last')
    k8sObject[s.tags.node_name] = {
      ...EmptyK8s,
      name: s.tags.node_name,
      type: 'Node',
      cpu: Number(s.values[0][lastIndex]),
    }
  })
  nodeMemorySeries.forEach(s => {
    const rssIndex = s.columns.findIndex(col => col === 'last')
    const workingIndex = s.columns.findIndex(col => col === 'last_1')
    k8sObject[s.tags.node_name].memory = Math.max(
      Number(s.values[0][rssIndex]),
      Number(s.values[0][workingIndex])
    )
  })
  podCpuSeries.forEach(s => {
    const lastIndex = s.columns.findIndex(col => col === 'last')
    k8sObject[s.tags.pod_name] = {
      ...EmptyK8s,
      name: s.tags.pod_name,
      type: 'Pod',
      cpu: Number(s.values[0][lastIndex]),
    }
  })
  podMemorySeries.forEach(s => {
    const rssIndex = s.columns.findIndex(col => col === 'last')
    const workingIndex = s.columns.findIndex(col => col === 'last_1')
    k8sObject[s.tags.pod_name].memory = k8sObject[
      s.tags.pod_name
    ].memory = Math.max(
      Number(s.values[0][rssIndex]),
      Number(s.values[0][workingIndex])
    )
  })
  console.log(k8sObject)
  return k8sObject
}
