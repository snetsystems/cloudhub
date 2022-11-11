export const AGENT_COLLECTOR_DIRECTORY = {
  FULL_DIR: '/srv/salt/prod/telegraf/',
}

export const AGENT_TELEGRAF_CONFIG = {
  FILE: '/etc/telegraf/telegraf.conf',
  TEMPDIRECTORY: '/etc/telegraf/temp',
  TEMPFILE: '/etc/telegraf/temp/timestamp.conf',
}

export const AGENT_TENANT_DIRECTORY = {
  DIR: '/etc/telegraf/telegraf.d/tenant/',
}

export const AGENT_TENANT_CLOUD_DIRECTORY = {
  openstack: 'osp',
  openshift: 'ocp',
}
