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
