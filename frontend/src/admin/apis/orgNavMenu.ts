import AJAX from 'src/utils/ajax'
import {
  MasterNavMenuUpsertRequest,
  OrgNavMenuUpsertRequest,
} from 'src/types/orgNavMenu'

const MASTER_NAV_MENU_URL = '/cloudhub/v1/nav-menu/master'

const orgNavMenuUrl = (orgId: string) =>
  `/cloudhub/v1/organizations/${encodeURIComponent(orgId)}/nav-menu`

export const getMasterNavMenu = async () => {
  return AJAX({
    method: 'GET',
    url: MASTER_NAV_MENU_URL,
  })
}

export const createMasterNavMenu = async (data: MasterNavMenuUpsertRequest) => {
  return AJAX({
    method: 'POST',
    url: MASTER_NAV_MENU_URL,
    data,
  })
}

export const updateMasterNavMenu = async (data: MasterNavMenuUpsertRequest) => {
  return AJAX({
    method: 'PUT',
    url: MASTER_NAV_MENU_URL,
    data,
  })
}

export const deleteMasterNavMenuItem = async (itemId: string) => {
  return AJAX({
    method: 'DELETE',
    url: `${MASTER_NAV_MENU_URL}/${encodeURIComponent(itemId)}`,
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
