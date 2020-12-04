import chroma from 'chroma-js'

export const clusterTypeColorset = {
  Node: '#ffffff',
  Pod: '#ffffff',
  ClusterRoles: '#5f5f5f',
  CR: '#5f5f5f',
  ClusterRoleBindings: '#5f5f5f',
  CRB: '#5f5f5f',
  Namespace: '#7f7f7f',
  Service: '#5f5f5f',
  SVC: '#5f5f5f',
  Secrets: '#5f5f5f',
  SR: '#5f5f5f',
  ServiceAccounts: '#5f5f5f',
  SA: '#5f5f5f',
  ReplicaSet: '#5f5f5f',
  RS: '#5f5f5f',
  Deployment: '#5f5f5f',
  DP: '#5f5f5f',
  Job: '#5f5f5f',
  CronJob: '#5f5f5f',
  CJ: '#5f5f5f',
  Ingress: '#5f5f5f',
  IGS: '#5f5f5f',
  ReplicationController: '#5f5f5f',
  RC: '#5f5f5f',
  Configmaps: '#5f5f5f',
  CM: '#5f5f5f',
  Roles: '#5f5f5f',
  RL: '#5f5f5f',
  RoleBindings: '#5f5f5f',
  RB: '#5f5f5f',
  DaemonSet: '#5f5f5f',
  DS: '#5f5f5f',
}

export const kubernetesStatusColor = chroma
  .scale(['#30e7f1', '#00cc2c', '#ff9e00', '#ff0000'])
  .mode('lrgb')
