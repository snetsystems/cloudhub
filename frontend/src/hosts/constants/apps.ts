import _ from 'lodash'

export const notIncludeApps: string[] = [
  'vsphere',
  'kubernetes',
  'cloudwatch',
  'stackdriver',
  'cloudwatch_elb',
  'openstack',
  'snmp_nx_by_interfaces',
  'snmp_nx_all',
]

export const excludedAppsForHostDetailsPage: string[] = ['snmp_nx_all']

export const awsApps: string[] = ['cloudwatch', 'cloudwatch_elb']

export const notIncludeAppsAWS: string[] = _.filter(
  notIncludeApps,
  m => !_.includes(awsApps, m)
)

export const gcpApps: string[] = ['stackdriver']

export const notIncludeAppsGCP: string[] = _.filter(
  notIncludeApps,
  m => !_.includes(gcpApps, m)
)

export const k8sApps: string[] = ['kubernetes']

export const notIncludeAppsK8s: string[] = _.filter(
  notIncludeApps,
  m => !_.includes(k8sApps, m)
)

export const vsphereApps: string[] = ['vsphere']

export const ospApps: string[] = ['openstack']

export const notIncludeAppsOsp: string[] = _.filter(
  notIncludeApps,
  m => !_.includes(ospApps, m)
)
