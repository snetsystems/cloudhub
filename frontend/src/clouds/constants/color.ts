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
  ClusterRoles: '#000',
  ClusterRole: '#000',
  CR: '#000',
  ClusterRoleBindings: '#000',
  ClusterRoleBinding: '#000',
  CRB: '#000',
  Namespace: '#31313d',
  Service: '#000',
  SVC: '#000',
  Secrets: '#000',
  Secret: '#000',
  SR: '#000',
  ServiceAccounts: '#000',
  ServiceAccount: '#000',
  SA: '#000',
  ReplicaSet: '#000',
  RS: '#000',
  Deployment: '#000',
  DP: '#000',
  Job: '#000',
  CronJob: '#000',
  CJ: '#000',
  Ingress: '#000',
  IGS: '#000',
  ReplicationController: '#000',
  RC: '#000',
  Configmaps: '#000',
  Configmap: '#000',
  CM: '#000',
  Roles: '#000',
  RL: '#000',
  RoleBindings: '#000',
  RoleBinding: '#000',
  Role: '#000',
  RB: '#000',
  DaemonSet: '#000',
  DS: '#000',
  PersistentVolume: '#31313d',
  PV: '#000',
}
// Namespace: '#7f7f7f',
// #5f5f5f -> #282828

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
