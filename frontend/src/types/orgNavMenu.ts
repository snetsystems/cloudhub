export interface MasterNavSubMenuItem {
  id: string
  label?: string
  sortOrder: number
  deleteYN: boolean
}

export interface MasterNavMenuItem {
  id: string
  label?: string
  icon?: string
  sortOrder: number
  deleteYN: boolean
  children?: MasterNavSubMenuItem[]
}

export interface MasterNavMenuResponse {
  navItems: MasterNavMenuItem[]
}

/** PUT master nav-menu body (create/update/restore). Omit soft-deleted nodes. */
export interface MasterNavMenuUpsertSubItem {
  id: string
  label?: string
  sortOrder?: number
}

export interface MasterNavMenuUpsertItem {
  id: string
  label?: string
  icon?: string
  sortOrder?: number
  children?: MasterNavMenuUpsertSubItem[]
}

export interface MasterNavMenuUpsertRequest {
  navItems: MasterNavMenuUpsertItem[]
}

export interface OrgNavSubMenuItem {
  id: string
  label?: string
  enabled: boolean
  sortOrder?: number
}

export interface OrgNavMenuItem {
  id: string
  label?: string
  icon?: string
  enabled: boolean
  sortOrder?: number
  children?: OrgNavSubMenuItem[]
}

export interface OrgNavMenuResponse {
  id?: string
  orgId: string
  navItems: OrgNavMenuItem[]
  isDegraded?: boolean
  warning?: string
}

export interface OrgNavMenuUpsertRequest {
  navItems: OrgNavMenuItem[]
}
