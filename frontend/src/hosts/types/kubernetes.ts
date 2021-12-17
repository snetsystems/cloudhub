import {SaltStack} from 'src/types/saltstack'
export interface D3K8sData {
  name: string
  children: D3DataDepth1[]
}

export interface D3DataDepth1 {
  name: string
  label: string
  type: string
  value?: number
  children: D3DataDepth2[]
}

export interface D3DataDepth2 {
  name: string
  label: string
  type: string
  owner?: string
  child?: string
  value?: number
  children?: D3DataDepth3[]
}

export interface D3DataDepth3 {
  name: string
  label: string
  type: string
  value: number
  owner?: string
  namespace?: string
}

export interface Kubernetes {
  name: string
  type: string
  cpu: string
  memory: string
}
export interface KubernetesObject {
  [key: string]: Kubernetes
}

export interface FocuseNode {
  name: string
  label: string
  type: string
}

export interface TooltipPosition {
  top: number
  right: number
  left: number
  width: number
}

export interface TooltipNode {
  name: string
  cpu: number
  memory: number
}

export interface KubernetesProps {
  handleGetMinionKeyAcceptedList: (
    saltMasterUrl: string,
    saltMasterToken: string
  ) => Promise<string[]>
  handleGetNamespaces: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetNodes: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetPods: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetDeployments: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetReplicaSets: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetReplicationControllers: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetDaemonSets: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetStatefulSets: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetJobs: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetCronJobs: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetServices: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetIngresses: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetConfigmaps: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetSecrets: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetServiceAccounts: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetClusterRoles: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetClusterRoleBindings: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetRoles: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetRoleBindings: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetPersistentVolumes: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetPersistentVolumeClaims: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
  handleGetK8sDetail: (
    saltMasterUrl: string,
    saltMasterToken: string,
    targetMinion: string,
    pParam?: SaltStack
  ) => Promise<any>
}
