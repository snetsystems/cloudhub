import {CollectorConfigTabName} from 'src/agent_admin/type/'

export const COLLECTOR_CONFIG_TABLE_DATA = [
  {
    name: 'authentication',
    label: 'Authentication Endpoint',
    placeholder: 'Authentication Endpoint',
    inputType: 'text',
    disabled: true,
  },
  {
    name: 'project',
    label: 'Project',
    placeholder: 'Project',
    inputType: 'text',
    disabled: true,
  },
  {
    name: 'domain',
    label: 'Domain',
    placeholder: 'Domain',
    inputType: 'text',
    disabled: true,
  },
  {
    name: 'username',
    label: 'Username',
    placeholder: 'Username',
    inputType: 'text',
    disabled: true,
  },
  {
    name: 'password',
    label: 'Password',
    placeholder: 'Password',
    inputType: 'password',
    disabled: true,
  },
  {
    name: 'service',
    label: 'Enabled Service',
    placeholder: 'Enabled Service',
    inputType: 'dropdown',
    disabled: false,
  },
  {
    name: 'interval',
    label: 'Interval',
    placeholder: 'Interval',
    inputType: 'text',
    disabled: false,
  },
]

export const COLLECTOR_DROPDOWN_DATA = [
  'agents',
  'aggregates',
  'flavors',
  'hypervisors',
  'networks',
  'nova_services',
  'ports',
  'projects',
  'servers',
  'services',
  'storage_pools',
  'subnets',
  'volumes',
  'compute_quotas',
  'network_quotas',
  'volume_quotas',
]

export const COLLECTOR_CONFIG_TAB_ABBREVIATION = {
  osp: 'openstack',
  ocp: 'openshift',
}

export const COLLECTOR_CONFIG_TAB_ORDER: CollectorConfigTabName[] = [
  'openstack',
  'openshift',
]
