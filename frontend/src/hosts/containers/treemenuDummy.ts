import {CloudServiceProvider} from 'src/hosts/types'

export const cloudData = {
  aws: {
    buttons: [],
    label: 'Amazon Web Service',
    index: 0,
    level: 0,
    provider: CloudServiceProvider.AWS,
    nodes: {},
  },
  gcp: {
    buttons: [],
    label: 'Google Cloud Platform',
    index: 1,
    level: 0,
    provider: CloudServiceProvider.GCP,
    nodes: {},
  },
  azure: {
    buttons: [],
    label: 'Azure',
    index: 2,
    level: 0,
    provider: CloudServiceProvider.AZURE,
    nodes: {},
  },
}

export const cloudInfo = [
  {
    provider: 'aws',
    region: 'ap-northeast-2',
    accesskey: 'accesskey',
    secretkey: 'secretkey',
    data: {},
  },
  {
    provider: 'aws',
    region: 'pusan',
    accesskey: 'accesskey',
    secretkey: 'secretkey',
    data: {},
  },
  {
    provider: 'gcp',
    region: 'seoul',
    accesskey: 'accesskey',
    secretkey: 'secretkey',
    data: {},
  },
]
