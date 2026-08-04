import AJAX from 'src/utils/ajax'

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

const MASTER_NAV_MENU_URL = '/cloudhub/v1/nav-menu/master'

const orgNavMenuUrl = (orgId: string) =>
  `/cloudhub/v1/organizations/${orgId}/nav-menu`

export const getMasterNavMenu = async () => {
  return AJAX({
    method: 'GET',
    url: MASTER_NAV_MENU_URL,
  })
}

export const createMasterNavMenu = async (data: OrgNavMenuUpsertRequest) => {
  return AJAX({
    method: 'POST',
    url: MASTER_NAV_MENU_URL,
    data,
  })
}

export const updateMasterNavMenu = async (data: OrgNavMenuUpsertRequest) => {
  return AJAX({
    method: 'PUT',
    url: MASTER_NAV_MENU_URL,
    data,
  })
}

export const deleteMasterNavMenuItem = async (itemId: string) => {
  return AJAX({
    method: 'DELETE',
    url: `${MASTER_NAV_MENU_URL}/${itemId}`,
  })
}

export const getOrgNavMenu = async (orgId: string) => {
  return AJAX({
    method: 'GET',
    url: orgNavMenuUrl(orgId),
  })
}

export const createOrgNavMenu = async (
  orgId: string,
  data: OrgNavMenuUpsertRequest
) => {
  return AJAX({
    method: 'POST',
    url: orgNavMenuUrl(orgId),
    data,
  })
}

export const updateOrgNavMenu = async (
  orgId: string,
  data: OrgNavMenuUpsertRequest
) => {
  return AJAX({
    method: 'PUT',
    url: orgNavMenuUrl(orgId),
    data,
  })
}

export const patchOrgNavMenu = async (
  orgId: string,
  data: OrgNavMenuUpsertRequest
) => {
  return AJAX({
    method: 'PATCH',
    url: orgNavMenuUrl(orgId),
    data,
  })
}