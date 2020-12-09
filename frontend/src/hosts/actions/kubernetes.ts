import {Dispatch} from 'redux'
import {errorThrown} from 'src/shared/actions/errors'
import _ from 'lodash'

// APIs
import {
  getLocalK8sNamespaces,
  getLocalK8sNodes,
  getLocalK8sPods,
  getLocalK8sDeployments,
  getLocalK8sReplicaSets,
  getLocalK8sReplicationControllers,
  getLocalK8sDaemonSets,
  getLocalK8sStatefulSets,
  getLocalK8sCronJobs,
  getLocalK8sJobs,
  getLocalK8sServices,
  getLocalK8sIngresses,
  getLocalK8sConfigmaps,
  getLocalK8sSecrets,
  getLocalK8sServiceAccounts,
  getLocalK8sClusterRoles,
  getLocalK8sClusterRoleBindings,
  getLocalK8sRoles,
  getLocalK8sRoleBindings,
  getLocalK8sPersistentVolumes,
  getLocalK8sPersistentVolumeClaims,
} from 'src/shared/apis/saltStack'

// Types
import {SaltStack} from 'src/types/saltstack'

export enum ActionTypes {
  Namespaces = 'GET_NAMESPACES',
  Nodes = 'GET_NODES',
  Pods = 'GET_PODS',
  Deployments = 'GET_DEPLOYMENTS',
  ReplicaSets = 'GET_REPLICASETS',
  ReplicationControllers = 'GET_REPLICATIONCONTROLLERS',
  DaemonSets = 'GET_DAEMONSETS',
  StatefulSets = 'GET_STATEFULSETS',
  CronJobs = 'GET_CRONJOBS',
  Jobs = 'GET_JOBS',
  Services = 'GET_SERVICES',
  Ingresses = 'GET_INGRESSES',
  Configmaps = 'GET_CONFIGMAPS',
  Secrets = 'GET_SECRETS',
  ServiceAccounts = 'GET_SERVICEACCOUNTS',
  ClusterRoles = 'GET_CLUSTERROLES',
  ClusterRoleBindings = 'GET_CLUSTERROLEBINDINGS',
  Roles = 'GET_ROLES',
  RoleBindings = 'GET_ROLEBINDINGS',
  PersistentVolumes = 'GET_PERSISTENTVOLUMES',
  PersistentVolumeClaims = 'GET_PERSISTENTVOLUMECLAIMS',
}

interface NamespacesAction {
  type: ActionTypes.Namespaces
}

interface NodesAction {
  type: ActionTypes.Nodes
}

interface PodsAction {
  type: ActionTypes.Pods
}

interface DeploymentsAction {
  type: ActionTypes.Deployments
}

interface ReplicaSetsAction {
  type: ActionTypes.ReplicaSets
}

interface ReplicationControllersAction {
  type: ActionTypes.ReplicationControllers
}

interface DaemonSetsAction {
  type: ActionTypes.DaemonSets
}

interface StatefulSetsAction {
  type: ActionTypes.StatefulSets
}

interface CronJobsAction {
  type: ActionTypes.CronJobs
}

interface JobsAction {
  type: ActionTypes.Jobs
}

interface ServicesAction {
  type: ActionTypes.Services
}

interface IngressesAction {
  type: ActionTypes.Ingresses
}

interface ConfigmapsAction {
  type: ActionTypes.Configmaps
}

interface SecretsAction {
  type: ActionTypes.Secrets
}

interface ServiceAccountsAction {
  type: ActionTypes.ServiceAccounts
}

interface ClusterRolesAction {
  type: ActionTypes.ClusterRoles
}

interface ClusterRoleBindingsAction {
  type: ActionTypes.ClusterRoleBindings
}

interface RolesAction {
  type: ActionTypes.Roles
}

interface RoleBindingsAction {
  type: ActionTypes.RoleBindings
}

interface PersistentVolumesAction {
  type: ActionTypes.PersistentVolumes
}

interface PersistentVolumeClaimsAction {
  type: ActionTypes.PersistentVolumeClaims
}

export type Action =
  | NamespacesAction
  | NodesAction
  | PodsAction
  | DeploymentsAction
  | ReplicaSetsAction
  | ReplicationControllersAction
  | DaemonSetsAction
  | StatefulSetsAction
  | JobsAction
  | CronJobsAction
  | ServicesAction
  | IngressesAction
  | ConfigmapsAction
  | SecretsAction
  | ServiceAccountsAction
  | ClusterRolesAction
  | ClusterRoleBindingsAction
  | RolesAction
  | RoleBindingsAction
  | PersistentVolumesAction
  | PersistentVolumeClaimsAction

export const loadNamespaces = (): NamespacesAction => ({
  type: ActionTypes.Namespaces,
})

export const loadNodes = (): NodesAction => ({
  type: ActionTypes.Nodes,
})

export const loadPods = (): PodsAction => ({
  type: ActionTypes.Pods,
})

export const loadDeployments = (): DeploymentsAction => ({
  type: ActionTypes.Deployments,
})

export const loadReplicaSets = (): ReplicaSetsAction => ({
  type: ActionTypes.ReplicaSets,
})

export const loadReplicationControllers = (): ReplicationControllersAction => ({
  type: ActionTypes.ReplicationControllers,
})

export const loadDaemonSets = (): DaemonSetsAction => ({
  type: ActionTypes.DaemonSets,
})

export const loadStatefulSets = (): StatefulSetsAction => ({
  type: ActionTypes.StatefulSets,
})

export const loadCronJobs = (): CronJobsAction => ({
  type: ActionTypes.CronJobs,
})

export const loadJobs = (): JobsAction => ({
  type: ActionTypes.Jobs,
})

export const loadServices = (): ServicesAction => ({
  type: ActionTypes.Services,
})

export const loadIngresses = (): IngressesAction => ({
  type: ActionTypes.Ingresses,
})

export const loadConfigmaps = (): ConfigmapsAction => ({
  type: ActionTypes.Configmaps,
})

export const loadSecrets = (): SecretsAction => ({
  type: ActionTypes.Secrets,
})

export const loadClusterRoles = (): ClusterRolesAction => ({
  type: ActionTypes.ClusterRoles,
})

export const loadServiceAccounts = (): ServiceAccountsAction => ({
  type: ActionTypes.ServiceAccounts,
})

export const loadClusterRoleBindings = (): ClusterRoleBindingsAction => ({
  type: ActionTypes.ClusterRoleBindings,
})

export const loadRoles = (): RolesAction => ({
  type: ActionTypes.Roles,
})

export const loadRoleBindings = (): RoleBindingsAction => ({
  type: ActionTypes.RoleBindings,
})

export const loadPersistentVolumes = (): PersistentVolumesAction => ({
  type: ActionTypes.PersistentVolumes,
})

export const loadPersistentVolumeClaims = (): PersistentVolumeClaimsAction => ({
  type: ActionTypes.PersistentVolumeClaims,
})

export const getLocalK8sNamespacesAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const namespaces = await getLocalK8sNamespaces(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadNamespaces())
    return namespaces
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sNodesAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const nodes = await getLocalK8sNodes(pUrl, pToken, pMinionId, pParam)

    dispatch(loadNodes())
    return nodes
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sPodsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const pods = await getLocalK8sPods(pUrl, pToken, pMinionId, pParam)

    dispatch(loadPods())
    return pods
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sDeploymentsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const deployments = await getLocalK8sDeployments(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadDeployments())
    return deployments
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sReplicaSetsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const replicaSets = await getLocalK8sReplicaSets(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadReplicaSets())
    return replicaSets
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sReplicationControllersAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const replicationControllers = await getLocalK8sReplicationControllers(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadReplicationControllers())
    return replicationControllers
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sDaemonSetsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const daemonSets = await getLocalK8sDaemonSets(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadDaemonSets())
    return daemonSets
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sStatefulSetsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const statefulSets = await getLocalK8sStatefulSets(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadStatefulSets())
    return statefulSets
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sCronJobsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const cronJobs = await getLocalK8sCronJobs(pUrl, pToken, pMinionId, pParam)

    dispatch(loadCronJobs())
    return cronJobs
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sJobsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const jobs = await getLocalK8sJobs(pUrl, pToken, pMinionId, pParam)

    dispatch(loadJobs())
    return jobs
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sServicesAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const services = await getLocalK8sServices(pUrl, pToken, pMinionId, pParam)

    dispatch(loadServices())
    return services
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sIngressesAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const ingresses = await getLocalK8sIngresses(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadIngresses())
    return ingresses
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sConfigmapsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const configmaps = await getLocalK8sConfigmaps(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadConfigmaps())
    return configmaps
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sSecretsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const secrets = await getLocalK8sSecrets(pUrl, pToken, pMinionId, pParam)

    dispatch(loadSecrets())
    return secrets
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sServiceAccountsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const serviceAccounts = await getLocalK8sServiceAccounts(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadServiceAccounts())
    return serviceAccounts
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sClusterRolesAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const clusterRoles = await getLocalK8sClusterRoles(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadClusterRoles())
    return clusterRoles
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sClusterRoleBindingsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const clusterRoleBindings = await getLocalK8sClusterRoleBindings(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadClusterRoleBindings())
    return clusterRoleBindings
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sRolesAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const roles = await getLocalK8sRoles(pUrl, pToken, pMinionId, pParam)

    dispatch(loadRoles())
    return roles
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sRoleBindingsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const roleBindings = await getLocalK8sRoleBindings(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadRoleBindings())
    return roleBindings
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sPersistentVolumesAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const persistentVolumes = await getLocalK8sPersistentVolumes(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadPersistentVolumes())
    return persistentVolumes
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalK8sPersistentVolumeClaimsAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam?: SaltStack
) => async (dispatch: Dispatch<Action>) => {
  try {
    const persistentVolumeClaims = await getLocalK8sPersistentVolumeClaims(
      pUrl,
      pToken,
      pMinionId,
      pParam
    )

    dispatch(loadPersistentVolumeClaims())
    return persistentVolumeClaims
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}
