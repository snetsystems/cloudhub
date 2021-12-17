export enum K8sNodeType {
  SVC = 'Service',
  IGS = 'Ingress',
  CM = 'Configmap',
  SR = 'Secret',
  SA = 'ServiceAccount',
  CR = 'ClusterRole',
  CRB = 'ClusterRoleBinding',
  RL = 'Role',
  RB = 'RoleBinding',
  PV = 'PersistentVolume',
  PVC = 'PersistentVolumeClaim',
  RS = 'ReplicaSet',
  DP = 'Deployment',
  RC = 'ReplicationController',
  DS = 'DaemonSet',
  SS = 'StatefulSet',
  Job = 'Job',
  CJ = 'CronJob',
  Pod = 'Pod',
  Node = 'Node',
  Namespace = 'Namespace',
}

export const k8sNodeTypeAttrs = {
  Namespace: {
    name: K8sNodeType.Namespace,
    saltParam: {
      fun: 'kubernetes.show_namespace',
      kwarg: {name: ''},
    },
  },
  Node: {
    name: K8sNodeType.Node,
    saltParam: {fun: 'kubernetes.node', kwarg: {name: ''}},
  },
  Pod: {
    name: K8sNodeType.Pod,
    saltParam: {fun: 'kubernetes.show_pod', kwarg: {namespace: '', name: ''}},
  },
  DP: {
    name: K8sNodeType.DP,
    saltParam: {
      fun: 'kubernetes.show_deployment',
      kwarg: {namespace: '', name: ''},
    },
  },
  RS: {
    name: K8sNodeType.RS,
    saltParam: {
      fun: 'kubernetes.show_replica_set',
      kwarg: {namespace: '', name: ''},
    },
  },
  RC: {
    name: K8sNodeType.RC,
    saltParam: {
      fun: 'kubernetes.show_replication_controller',
      kwarg: {namespace: '', name: ''},
    },
  },
  DS: {
    name: K8sNodeType.DS,
    saltParam: {
      fun: 'kubernetes.show_daemon_set',
      kwarg: {namespace: '', name: ''},
    },
  },
  SS: {
    name: K8sNodeType.SS,
    saltParam: {
      fun: 'kubernetes.show_stateful_set',
      kwarg: {namespace: '', name: ''},
    },
  },
  Job: {
    name: K8sNodeType.Job,
    saltParam: {
      fun: 'kubernetes.show_job',
      kwarg: {namespace: '', name: ''},
    },
  },
  CJ: {
    name: K8sNodeType.CJ,
    saltParam: {
      fun: 'kubernetes.show_cron_job',
      kwarg: {namespace: '', name: ''},
    },
  },
  SVC: {
    name: K8sNodeType.SVC,
    saltParam: {
      fun: 'kubernetes.show_service',
      kwarg: {namespace: '', name: ''},
    },
  },
  IGS: {
    name: K8sNodeType.IGS,
    saltParam: {
      fun: 'kubernetes.show_ingress',
      kwarg: {namespace: '', name: ''},
    },
  },
  CM: {
    name: K8sNodeType.CM,
    saltParam: {
      fun: 'kubernetes.show_configmap',
      kwarg: {namespace: '', name: ''},
    },
  },
  SR: {
    name: K8sNodeType.SR,
    saltParam: {
      fun: 'kubernetes.show_secret',
      kwarg: {namespace: '', name: ''},
    },
  },
  SA: {
    name: K8sNodeType.SA,
    saltParam: {
      fun: 'kubernetes.show_service_account',
      kwarg: {namespace: '', name: ''},
    },
  },
  CR: {
    name: K8sNodeType.CR,
    saltParam: {
      fun: 'kubernetes.show_cluster_role',
      kwarg: {name: ''},
    },
  },
  CRB: {
    name: K8sNodeType.CRB,
    saltParam: {
      fun: 'kubernetes.show_cluster_role_binding',
      kwarg: {name: ''},
    },
  },
  RL: {
    name: K8sNodeType.RL,
    saltParam: {
      fun: 'kubernetes.show_role',
      kwarg: {namespace: '', name: ''},
    },
  },
  RB: {
    name: K8sNodeType.RB,
    saltParam: {
      fun: 'kubernetes.show_role_binding',
      kwarg: {namespace: '', name: ''},
    },
  },
  PV: {
    name: K8sNodeType.PV,
    saltParam: {
      fun: 'kubernetes.show_persistent_volume',
      kwarg: {name: ''},
    },
  },
  PVC: {
    name: K8sNodeType.PVC,
    saltParam: {
      fun: 'kubernetes.show_persistent_volume_claim',
      kwarg: {namespace: '', name: ''},
    },
  },
}
