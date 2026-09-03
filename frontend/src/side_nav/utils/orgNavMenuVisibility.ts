import {isOrgMenuLocked} from 'src/admin/constants/sidebarMenuItems'

export const isOrgNavMenuEnabled = (
  selection: Record<string, boolean> | null | undefined,
  menuId: string
): boolean => {
  if (isOrgMenuLocked(menuId)) {
    return true
  }
  if (!selection || !(menuId in selection)) {
    return true
  }
  return selection[menuId] !== false
}

export const DEFAULT_NAV_CHILD: Record<string, string> = {
  'ai-chat': 'ai-chatbot',
  'network-monitoring': 'network-anomaly',
  'server-monitoring': 'server-list',
  'url-monitoring': 'url-list',
  kubernetes: 'k8s-cluster-map',
  'log-viewer': 'log-analysis',
  alert: 'alert-rules',
  admin: 'admin-cloudhub',
}

export const resolveNavDestination = (
  selection: Record<string, boolean> | null | undefined,
  items: Array<{id: string; path: string; available?: boolean}>,
  defaultId?: string
): string | null => {
  const on = items.filter(
    item => item.available !== false && isOrgNavMenuEnabled(selection, item.id)
  )
  if (!on.length) {
    return null
  }
  const preferred = defaultId && on.find(item => item.id === defaultId)
  return preferred ? preferred.path : on[0].path
}
