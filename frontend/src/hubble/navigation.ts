export const KUBERNETES_OVERVIEW_ROUTE = 'kubernetes'
export const KUBERNETES_NETWORK_ROUTE = 'kubernetes/network'
export const LEGACY_HUBBLE_ROUTE = 'hubble'

export interface KubernetesNavItem {
  label: string
  link: string
  exact?: boolean
  icon?: string
}

export const buildKubernetesNavItems = (
  sourcePrefix: string
): KubernetesNavItem[] => [
  {
    label: 'Cluster Map',
    link: `${sourcePrefix}/${KUBERNETES_OVERVIEW_ROUTE}`,
    exact: true,
    icon: 'cluster',
  },
  {
    label: 'Traffic Map',
    link: `${sourcePrefix}/${KUBERNETES_NETWORK_ROUTE}`,
    icon: 'shuffle',
  },
]
