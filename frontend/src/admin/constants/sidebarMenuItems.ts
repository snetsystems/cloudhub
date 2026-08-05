import {MasterNavMenuItem, OrgNavMenuItem} from 'src/types/orgNavMenu'

export interface SidebarMenuItem {
  id: string
  label: string
  icon?: string
  children?: SidebarMenuItem[]
}

export const mapMasterNavItemsToSidebarMenuItems = (
  navItems: MasterNavMenuItem[] = []
): SidebarMenuItem[] => {
  return navItems
    .filter(item => !item.deleteYN)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(item => ({
      id: item.id,
      label: item.label || item.id,
      icon: item.icon,
      children: (item.children || [])
        .filter(child => !child.deleteYN)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(child => ({
          id: child.id,
          label: child.label || child.id,
        })),
    }))
}

export const mapOrgNavItemsToSidebarMenuItems = (
  navItems: OrgNavMenuItem[] = []
): SidebarMenuItem[] => {
  return [...navItems]
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(item => ({
      id: item.id,
      label: item.label || item.id,
      icon: item.icon,
      children: [...(item.children || [])]
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map(child => ({
          id: child.id,
          label: child.label || child.id,
        })),
    }))
}

export const mapOrgNavItemsToSelection = (
  navItems: OrgNavMenuItem[] = []
): Record<string, boolean> => {
  return navItems.reduce<Record<string, boolean>>((acc, item) => {
    acc[item.id] = !!item.enabled
    ;(item.children || []).forEach(child => {
      acc[child.id] = !!child.enabled
    })
    return acc
  }, {})
}

const collectSidebarMenuIds = (items: SidebarMenuItem[]): string[] => {
  return items.reduce<string[]>((ids, item) => {
    ids.push(item.id)
    if (item.children) {
      ids.push(...collectSidebarMenuIds(item.children))
    }
    return ids
  }, [])
}

export const createDefaultMenuSelection = (
  items: SidebarMenuItem[]
): Record<string, boolean> => {
  return collectSidebarMenuIds(items).reduce<Record<string, boolean>>(
    (acc, id) => {
      acc[id] = true
      return acc
    },
    {}
  )
}

export const buildOrgNavMenuUpsertPayload = (
  items: SidebarMenuItem[],
  selection: Record<string, boolean>
): OrgNavMenuItem[] => {
  return items.map(item => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    enabled: selection[item.id] !== false,
    children: (item.children || []).map(child => ({
      id: child.id,
      label: child.label,
      enabled: selection[child.id] !== false,
    })),
  }))
}

export const findSidebarMenuItem = (
  menuId: string,
  items: SidebarMenuItem[]
): SidebarMenuItem | undefined => {
  for (const item of items) {
    if (item.id === menuId) {
      return item
    }
    if (item.children) {
      const found = findSidebarMenuItem(menuId, item.children)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

export const collectDescendantMenuIds = (item: SidebarMenuItem): string[] => {
  if (!item.children || !item.children.length) {
    return []
  }
  return collectSidebarMenuIds(item.children)
}

export const collectAncestorMenuIds = (
  menuId: string,
  items: SidebarMenuItem[],
  ancestors: string[] = []
): string[] | null => {
  for (const item of items) {
    if (item.id === menuId) {
      return ancestors
    }
    if (item.children) {
      const found = collectAncestorMenuIds(menuId, item.children, [
        ...ancestors,
        item.id,
      ])
      if (found) {
        return found
      }
    }
  }
  return null
}
