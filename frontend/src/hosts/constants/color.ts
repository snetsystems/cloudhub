import chroma from 'chroma-js'

export const clusterTypeColorset = {
  ClusterRoles: '#0033cc',
  CR: '#0033cc',
  ClusterRoleBindings: '#0033cc',
  CRB: '#0033cc',
  Namespace: '#7f7f7f',
  Service: '#0033cc',
  SVC: '#0033cc',
  Secrets: '#ffd966',
  SR: '#ffd966',
  ServiceAccounts: '#0033cc',
  SA: '#0033cc',
  ReplicaSet: '#e2f0d9',
  RS: '#e2f0d9',
  Deployment: '#ffd966',
  DP: '#ffd966',
  Node: '#2e75b6',
  Pod: '#2e75b6',
  Job: '#fed2d2',
  CronJob: '#fed2d2',
  CJ: '#0033cc',
  Ingress: '#0033cc',
  IGS: '#0033cc',
  ReplicationController: '#9dc3e6',
  RC: '#9dc3e6',
  Configmaps: '#0033cc',
  CM: '#0033cc',
  Roles: '#a27bb3',
  RL: '#a27bb3',
  RoleBindings: '#a27bb3',
  RB: '#a27bb3',
  DaemonSet: '#74b8ba',
  DS: '#74b8ba',
}

export const kubernetesStatusColor = chroma
  .scale(['#30e7f1', '#00cc2c', '#ff9e00', '#ff0000'])
  .mode('lrgb')
