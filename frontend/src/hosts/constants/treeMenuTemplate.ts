import {CloudServiceProvider} from 'src/hosts/types'

export const cloudTreeMenuTemplate = {
  aws: {
    buttons: [{provider: 'aws', isUpdate: false, text: 'Add Region'}],
    label: 'Amazon Web Service',
    index: 0,
    level: 0,
    provider: CloudServiceProvider.AWS,
    nodes: {},
  },
  gcp: {
    buttons: [{provider: 'gcp', isUpdate: false, text: 'Add Region'}],
    label: 'Google Cloud Platform',
    index: 1,
    level: 0,
    provider: CloudServiceProvider.GCP,
    nodes: {},
  },
  azure: {
    buttons: [{provider: 'azure', isUpdate: false, text: 'Add Region'}],
    label: 'Azure',
    index: 2,
    level: 0,
    provider: CloudServiceProvider.AZURE,
    nodes: {},
  },
}
