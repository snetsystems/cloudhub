export const KUBERNETES_OVERVIEW_ROUTE = 'kubernetes'
export const KUBERNETES_NETWORK_ROUTE = 'kubernetes/network'
export const LEGACY_HUBBLE_ROUTE = 'hubble'

export interface KubernetesNavItem {
  id: string
  label: string
  link: string
  exact?: boolean
  icon?: string
}

export const buildKubernetesNavItems = (
  sourcePrefix: string
): KubernetesNavItem[] => [
  {
    id: 'k8s-cluster-map',
    label: 'Cluster Map',
    link: `${sourcePrefix}/${KUBERNETES_OVERVIEW_ROUTE}`,
    exact: true,
    icon: 'cluster',
  },
  {
    id: 'k8s-traffic-map',
    label: 'Traffic Map',
    link: `${sourcePrefix}/${KUBERNETES_NETWORK_ROUTE}`,
    icon: 'shuffle',
  },
]
