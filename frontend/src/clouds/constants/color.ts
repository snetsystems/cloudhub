import chroma from 'chroma-js'
import {
  COLOR_TYPE_MAX,
  COLOR_TYPE_MIN,
  DEFAULT_VALUE_MAX,
  DEFAULT_VALUE_MIN,
  THRESHOLD_COLORS,
} from 'src/shared/constants/thresholds'

export const clusterTypeColorset = {
  Node: '#ffffff',
  Pod: '#ffffff',
  ClusterRoles: '#5f5f5f',
  ClusterRole: '#5f5f5f',
  CR: '#5f5f5f',
  ClusterRoleBindings: '#5f5f5f',
  ClusterRoleBinding: '#5f5f5f',
  CRB: '#5f5f5f',
  Namespace: '#7f7f7f',
  Service: '#5f5f5f',
  SVC: '#5f5f5f',
  Secrets: '#5f5f5f',
  Secret: '#5f5f5f',
  SR: '#5f5f5f',
  ServiceAccounts: '#5f5f5f',
  ServiceAccount: '#5f5f5f',
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
  Configmap: '#5f5f5f',
  CM: '#5f5f5f',
  Roles: '#5f5f5f',
  RL: '#5f5f5f',
  RoleBindings: '#5f5f5f',
  RoleBinding: '#5f5f5f',
  Role: '#5f5f5f',
  RB: '#5f5f5f',
  DaemonSet: '#5f5f5f',
  DS: '#5f5f5f',
}

export const kubernetesStatusColor = chroma
  .scale(['#30e7f1', '#00cc2c', '#ff9e00', '#ff0000'])
  .mode('lrgb')

export const OPENSTACK_GAUGE_COLORS = [
  {
    type: COLOR_TYPE_MIN,
    hex: THRESHOLD_COLORS[11].hex,
    id: '0',
    name: THRESHOLD_COLORS[11].name,
    value: DEFAULT_VALUE_MIN,
  },

  {
    type: COLOR_TYPE_MAX,
    hex: THRESHOLD_COLORS[1].hex,
    id: '1',
    name: THRESHOLD_COLORS[1].name,
    value: DEFAULT_VALUE_MAX,
  },
]
