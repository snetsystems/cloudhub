// Libraries
import _ from 'lodash'
import AJAX from 'src/utils/ajax'

// Types
interface Params {
  token?: string
  client?: string
  fun?: string
  arg?: string[] | string
  tgt_type?: string
  tgt?: string[] | string
  match?: string
  include_rejected?: string
  include_denied?: string
  include_accepted?: string
  show_ip?: string
  kwarg?: {
    username?: string
    password?: string
    eauth?: string
    name?: string
    path?: string
    dest?: string
    makedirs?: string
    fun?: string
    cmd?: string
    sources?: string
    args?: string[] | string
    url?: string
    method?: string
    api_host?: string
    api_user?: string
    api_pass?: string
    region?: string
    keyid?: string
    key?: string
    group_ids?: string | string[]
    volume_ids?: string | string[]
    instance_types?: string | string[]
    detail?: any
    namespace?: any
    fieldselector?: any
    labelselector?: any
    limit?: number
    namespaces?: string[]
    dir_path?: string
    mode?: string
    name_or_id?: string
  }
  username?: string
  password?: string
  eauth?: string
  token_expire?: number
  provider?: string
  func?: string
}

async function kubernetesProxyRequest(
  endpoint: string,
  queryParams?: Record<string, string>
) {
  try {
    const proxyUrl = `/cloudhub/v1/kubernetes/proxy${endpoint}`

    let finalUrl = proxyUrl
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams()
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value) {
          params.append(key, value)
        }
      })
      finalUrl = `${proxyUrl}?${params.toString()}`
    }

    const ajaxResult = await AJAX({
      method: 'GET',
      url: finalUrl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    return ajaxResult.data
  } catch (error) {
    console.error('Kubernetes Proxy API error:', error)
    return null
  }
}

async function k8sListWithNamespaces(
  clusterPath: string,
  nsPathTemplate: string,
  namespaces?: string[],
  queryParams?: Record<string, string>
) {
  if (Array.isArray(namespaces) && namespaces.length > 0) {
    const results = await Promise.all(
      namespaces.map(ns =>
        kubernetesProxyRequest(nsPathTemplate.replace('{ns}', ns), queryParams)
      )
    )

    const mergedItems = results.flatMap(res => {
      const body =
        res && typeof res === 'object' && 'data' in res
          ? (res as any).data
          : res
      return body?.items || []
    })

    return {items: mergedItems}
  }

  return await kubernetesProxyRequest(clusterPath, queryParams)
}

function convertToSaltStackFormat(data: any, resourceType: string) {
  const body =
    data && typeof data === 'object' && 'data' in data
      ? (data as any).data
      : data
  if (!body?.items) return body

  const toSnakeForUI = (type: string, item: any) => {
    const obj = _.cloneDeep(item)

    if (obj.metadata) {
      const m = obj.metadata
      if (m.resourceVersion && !m.resource_version)
        m.resource_version = m.resourceVersion
      if (m.creationTimestamp && !m.creation_timestamp)
        m.creation_timestamp = m.creationTimestamp
      if (m.ownerReferences && !m.owner_references)
        m.owner_references = m.ownerReferences
      if (m.managedFields && !m.managed_fields)
        m.managed_fields = m.managedFields
    }

    if (type === 'pods' && obj.spec) {
      if (obj.spec.nodeName && !obj.spec.node_name)
        obj.spec.node_name = obj.spec.nodeName
      if (Array.isArray(obj.spec.volumes)) {
        obj.spec.volumes = obj.spec.volumes.map(v => {
          const vol = _.cloneDeep(v)
          if (vol.persistentVolumeClaim) {
            vol.persistent_volume_claim = vol.persistentVolumeClaim
            if (
              vol.persistent_volume_claim.claimName &&
              !vol.persistent_volume_claim.claim_name
            ) {
              vol.persistent_volume_claim.claim_name =
                vol.persistent_volume_claim.claimName
            }
          }
          return vol
        })
      }
    }

    if (type === 'services' && obj.spec) {
      if (obj.spec.clusterIP && !obj.spec.cluster_ip)
        obj.spec.cluster_ip = obj.spec.clusterIP
    }

    if (obj.status) {
      if (
        obj.status.availableReplicas !== undefined &&
        obj.status.available_replicas === undefined
      ) {
        obj.status.available_replicas = obj.status.availableReplicas
      }
    }

    if (type === 'ingresses' && obj.spec?.rules) {
      obj.spec.rules = obj.spec.rules.map((rule: any) => {
        const r = _.cloneDeep(rule)
        if (r.http?.paths) {
          r.http.paths = r.http.paths.map((p: any) => {
            const path = _.cloneDeep(p)
            const svcName =
              path.backend?.service?.name || path.backend?.serviceName
            if (svcName && !path.backend?.service_name) {
              path.backend = {...path.backend, service_name: svcName}
            }
            return path
          })
        }
        return r
      })
    }

    if (type === 'persistentvolumeclaims' && obj.spec) {
      if (obj.spec.volumeName && !obj.spec.volume_name)
        obj.spec.volume_name = obj.spec.volumeName
    }

    if (type === 'persistentvolumes' && obj.spec) {
      if (obj.spec.accessModes && !obj.spec.access_modes)
        obj.spec.access_modes = obj.spec.accessModes
    }

    return obj
  }

  return body.items.map((it: any) => toSnakeForUI(resourceType, it))
}

export async function getKubernetesNamespacesProxy(pParam: Params) {
  try {
    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest('/api/v1/namespaces', queryParams)
    return convertToSaltStackFormat(data, 'namespaces')
  } catch (error) {
    console.error('Kubernetes Namespaces Proxy API error:', error)
    return []
  }
}

export async function getKubernetesPodsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/pods`
      : '/api/v1/pods'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/api/v1/pods',
          '/api/v1/namespaces/{ns}/pods',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'pods')
  } catch (error) {
    console.error('Kubernetes Pods Proxy API error:', error)
    return []
  }
}

export async function getKubernetesServicesProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/services`
      : '/api/v1/services'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/api/v1/services',
          '/api/v1/namespaces/{ns}/services',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'services')
  } catch (error) {
    console.error('Kubernetes Services Proxy API error:', error)
    return []
  }
}

export async function getKubernetesDeploymentsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/apps/v1/namespaces/${namespace}/deployments`
      : '/apis/apps/v1/deployments'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'deployments')
  } catch (error) {
    console.error('Kubernetes Deployments Proxy API error:', error)
    return []
  }
}

export async function getKubernetesReplicaSetsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/apps/v1/namespaces/${namespace}/replicasets`
      : '/apis/apps/v1/replicasets'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'replicasets')
  } catch (error) {
    console.error('Kubernetes ReplicaSets Proxy API error:', error)
    return []
  }
}

export async function getKubernetesReplicationControllersProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/replicationcontrollers`
      : '/api/v1/replicationcontrollers'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'replicationcontrollers')
  } catch (error) {
    console.error('Kubernetes ReplicationControllers Proxy API error:', error)
    return []
  }
}

export async function getKubernetesDaemonSetsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/apps/v1/namespaces/${namespace}/daemonsets`
      : '/apis/apps/v1/daemonsets'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'daemonsets')
  } catch (error) {
    console.error('Kubernetes DaemonSets Proxy API error:', error)
    return []
  }
}

export async function getKubernetesStatefulSetsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/apps/v1/namespaces/${namespace}/statefulsets`
      : '/apis/apps/v1/statefulsets'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'statefulsets')
  } catch (error) {
    console.error('Kubernetes StatefulSets Proxy API error:', error)
    return []
  }
}

export async function getKubernetesJobsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/batch/v1/namespaces/${namespace}/jobs`
      : '/apis/batch/v1/jobs'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'jobs')
  } catch (error) {
    console.error('Kubernetes Jobs Proxy API error:', error)
    return []
  }
}

export async function getKubernetesCronJobsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/batch/v1/namespaces/${namespace}/cronjobs`
      : '/apis/batch/v1/cronjobs'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'cronjobs')
  } catch (error) {
    console.error('Kubernetes CronJobs Proxy API error:', error)
    return []
  }
}

export async function getKubernetesNodesProxy(pParam: Params) {
  try {
    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest('/api/v1/nodes', queryParams)
    return convertToSaltStackFormat(data, 'nodes')
  } catch (error) {
    console.error('Kubernetes Nodes Proxy API error:', error)
    return []
  }
}

export async function getKubernetesIngressesProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses`
      : '/apis/networking.k8s.io/v1/ingresses'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/apis/networking.k8s.io/v1/ingresses',
          '/apis/networking.k8s.io/v1/namespaces/{ns}/ingresses',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'ingresses')
  } catch (error) {
    console.error('Kubernetes Ingresses Proxy API error:', error)
    return []
  }
}

export async function getKubernetesServiceAccountsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/serviceaccounts`
      : '/api/v1/serviceaccounts'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/api/v1/serviceaccounts',
          '/api/v1/namespaces/{ns}/serviceaccounts',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'serviceaccounts')
  } catch (error) {
    console.error('Kubernetes ServiceAccounts Proxy API error:', error)
    return []
  }
}

export async function getKubernetesRolesProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/roles`
      : '/apis/rbac.authorization.k8s.io/v1/roles'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/apis/rbac.authorization.k8s.io/v1/roles',
          '/apis/rbac.authorization.k8s.io/v1/namespaces/{ns}/roles',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'roles')
  } catch (error) {
    console.error('Kubernetes Roles Proxy API error:', error)
    return []
  }
}

export async function getKubernetesRoleBindingsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings`
      : '/apis/rbac.authorization.k8s.io/v1/rolebindings'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/apis/rbac.authorization.k8s.io/v1/rolebindings',
          '/apis/rbac.authorization.k8s.io/v1/namespaces/{ns}/rolebindings',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'rolebindings')
  } catch (error) {
    console.error('Kubernetes RoleBindings Proxy API error:', error)
    return []
  }
}

export async function getKubernetesPersistentVolumesProxy(pParam: Params) {
  try {
    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest(
      '/api/v1/persistentvolumes',
      queryParams
    )
    return convertToSaltStackFormat(data, 'persistentvolumes')
  } catch (error) {
    console.error('Kubernetes PersistentVolumes Proxy API error:', error)
    return []
  }
}

export async function getKubernetesPersistentVolumeClaimsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/persistentvolumeclaims`
      : '/api/v1/persistentvolumeclaims'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'persistentvolumeclaims')
  } catch (error) {
    console.error('Kubernetes PersistentVolumeClaims Proxy API error:', error)
    return []
  }
}

export async function getKubernetesNamespacesMultiProxy(pParam: Params) {
  try {
    const namespaceNames = pParam.kwarg?.namespaces || [
      'default',
      'kube-system',
    ]

    const promises = namespaceNames.map(async (name: string) => {
      try {
        const data = await kubernetesProxyRequest(`/api/v1/namespaces/${name}`)
        const body =
          data && typeof data === 'object' && 'data' in data ? data.data : data

        return {
          name: body.metadata?.name,
          uid: body.metadata?.uid,
          resource_version: body.metadata?.resourceVersion,
          creation_timestamp: body.metadata?.creationTimestamp,
          labels: body.metadata?.labels || {},
        }
      } catch (error) {
        console.warn(`Failed to fetch namespace ${name}:`, error)
        return null
      }
    })

    const results = await Promise.all(promises)

    return results.filter(result => result !== null)
  } catch (error) {
    console.error('Kubernetes Multi Proxy API error:', error)
    return []
  }
}

export async function getKubernetesDetailProxy(pParam: Params) {
  try {
    const fun = pParam.fun || ''
    const namespace = pParam.kwarg?.namespace || ''
    const name = pParam.kwarg?.name || ''

    if (!fun || !name) {
      throw new Error('Function and name are required')
    }

    const resourceType = fun
      .replace('kubernetes.show_', '')
      .replace('kubernetes.', '')

    let endpoint = ''
    switch (resourceType.toLowerCase()) {
      case 'pod':
        endpoint = namespace
          ? `/api/v1/namespaces/${namespace}/pods/${name}`
          : `/api/v1/pods/${name}`
        break
      case 'service':
        endpoint = namespace
          ? `/api/v1/namespaces/${namespace}/services/${name}`
          : `/api/v1/services/${name}`
        break
      case 'deployment':
        endpoint = namespace
          ? `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`
          : `/apis/apps/v1/deployments/${name}`
        break
      case 'replication_controller':
        endpoint = namespace
          ? `/api/v1/namespaces/${namespace}/replicationcontrollers/${name}`
          : `/api/v1/replicationcontrollers/${name}`
        break
      case 'replica_set':
        endpoint = namespace
          ? `/apis/apps/v1/namespaces/${namespace}/replicasets/${name}`
          : `/apis/apps/v1/replicasets/${name}`
        break
      case 'daemon_set':
        endpoint = namespace
          ? `/apis/apps/v1/namespaces/${namespace}/daemonsets/${name}`
          : `/apis/apps/v1/daemonsets/${name}`
        break
      case 'stateful_set':
        endpoint = namespace
          ? `/apis/apps/v1/namespaces/${namespace}/statefulsets/${name}`
          : `/apis/apps/v1/statefulsets/${name}`
        break
      case 'job':
        endpoint = namespace
          ? `/apis/batch/v1/namespaces/${namespace}/jobs/${name}`
          : `/apis/batch/v1/jobs/${name}`
        break
      case 'cron_job':
        endpoint = namespace
          ? `/apis/batch/v1/namespaces/${namespace}/cronjobs/${name}`
          : `/apis/batch/v1/cronjobs/${name}`
        break
      case 'persistent_volume':
        endpoint = `/api/v1/persistentvolumes/${name}`
        break
      case 'persistent_volume_claim':
        endpoint = namespace
          ? `/api/v1/namespaces/${namespace}/persistentvolumeclaims/${name}`
          : `/api/v1/persistentvolumeclaims/${name}`
        break
      case 'configmap':
        endpoint = namespace
          ? `/api/v1/namespaces/${namespace}/configmaps/${name}`
          : `/api/v1/configmaps/${name}`
        break
      case 'secret':
        endpoint = namespace
          ? `/api/v1/namespaces/${namespace}/secrets/${name}`
          : `/api/v1/secrets/${name}`
        break
      case 'ingress':
        endpoint = namespace
          ? `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses/${name}`
          : `/apis/networking.k8s.io/v1/ingresses/${name}`
        break
      case 'service_account':
        endpoint = namespace
          ? `/api/v1/namespaces/${namespace}/serviceaccounts/${name}`
          : `/api/v1/serviceaccounts/${name}`
        break
      case 'role':
        endpoint = namespace
          ? `/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/roles/${name}`
          : `/apis/rbac.authorization.k8s.io/v1/roles/${name}`
        break
      case 'role_binding':
        endpoint = namespace
          ? `/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings/${name}`
          : `/apis/rbac.authorization.k8s.io/v1/rolebindings/${name}`
        break
      case 'cluster_role':
        endpoint = `/apis/rbac.authorization.k8s.io/v1/clusterroles/${name}`
        break
      case 'cluster_role_binding':
        endpoint = `/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/${name}`
        break
      case 'node':
        endpoint = `/api/v1/nodes/${name}`
        break
      case 'namespace':
        endpoint = `/api/v1/namespaces/${name}`
        break
      default:
        throw new Error(`Unsupported resource type: ${resourceType}`)
    }

    const data = await kubernetesProxyRequest(endpoint)

    let cleanedData = {...data}

    delete cleanedData.managed_fields
    delete cleanedData.annotations
    delete cleanedData.managedFields
    delete cleanedData.annotations

    if (cleanedData.metadata) {
      delete cleanedData.metadata.managed_fields
      delete cleanedData.metadata.annotations
      delete cleanedData.metadata.managedFields
      delete cleanedData.metadata.annotations
    }

    const cleanedDataWithoutNull = JSON.parse(
      JSON.stringify(cleanedData, (_, value) => {
        if (value === null) return undefined
        if (
          value &&
          typeof value === 'object' &&
          Object.keys(value).length === 0
        )
          return undefined
        return value
      })
    )

    return {
      data: cleanedDataWithoutNull,
    }
  } catch (error) {
    console.error('Kubernetes Detail Proxy API error:', error)
    return null
  }
}

export async function getKubernetesCustomObjectDetail(params: {
  group: string
  version: string
  name: string
  namespace?: string
  plural: string
}) {
  const {group, version, name, namespace, plural} = params
  if (!group || !version || !name || !plural) {
    throw new Error('group, version, name, plural are required')
  }
  const base = `/apis/${group}/${version}`
  const endpoint = namespace
    ? `${base}/namespaces/${namespace}/${plural}/${name}`
    : `${base}/${plural}/${name}`
  const data = await kubernetesProxyRequest(endpoint)

  let cleanedData: any = {...data}
  delete cleanedData.managed_fields
  delete cleanedData.managedFields
  delete cleanedData.annotations
  if (cleanedData.metadata) {
    delete cleanedData.metadata.managed_fields
    delete cleanedData.metadata.managedFields
    delete cleanedData.metadata.annotations
  }

  const cleanedDataWithoutNull = JSON.parse(
    JSON.stringify(cleanedData, (_, value) => {
      if (value === null) return undefined
      if (value && typeof value === 'object' && Object.keys(value).length === 0)
        return undefined
      return value
    })
  )

  return {data: cleanedDataWithoutNull}
}

export async function getKubernetesConfigMapsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/configmaps`
      : '/api/v1/configmaps'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'configmaps')
  } catch (error) {
    console.error('Kubernetes ConfigMaps Proxy API error:', error)
    return []
  }
}

export async function getKubernetesSecretsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/secrets`
      : '/api/v1/secrets'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'secrets')
  } catch (error) {
    console.error('Kubernetes Secrets Proxy API error:', error)
    return []
  }
}
