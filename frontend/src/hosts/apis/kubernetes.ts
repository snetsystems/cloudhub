// Libraries
import _ from 'lodash'

// Utils
import {getDeep} from 'src/utils/wrappers'
import replaceTemplate from 'src/tempVars/utils/replace'
import {proxy} from 'src/utils/queryUrlGenerator'

// Types
import {Template} from 'src/types'
import {KubernetesObject} from 'src/hosts/types'

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
    `SELECT last("cpu_usage_nanocores") / 1000000 FROM \":db:\".\":rp:\".\"kubernetes_node\" WHERE time > now() - 10m GROUP BY node_name;
      SELECT last("memory_rss_bytes"), last("memory_working_set_bytes") FROM \":db:\".\":rp:\".\"kubernetes_node\" WHERE time > now() - 10m GROUP BY node_name;
      SELECT last("cpu_usage_nanocores") / 1000000 FROM \":db:\".\":rp:\".\"kubernetes_pod_container\" WHERE time > now() - 10m GROUP BY pod_name;
      SELECT last("memory_rss_bytes"), last("memory_working_set_bytes") FROM \":db:\".\":rp:\".\"kubernetes_pod_container\" WHERE time > now() - 10m GROUP BY pod_name;`,
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

  return k8sObject
}
