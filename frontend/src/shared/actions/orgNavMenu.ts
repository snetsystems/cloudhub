import {getOrgNavMenu} from 'src/admin/apis/orgNavMenu'
import {mapOrgNavItemsToSelection} from 'src/admin/constants/sidebarMenuItems'

export enum OrgNavMenuActionTypes {
  SetOrgNavMenu = 'ORG_NAV_MENU_SET',
}

export interface OrgNavMenuState {
  orgId: string | null
  selection: Record<string, boolean>
}

export interface SetOrgNavMenuAction {
  type: OrgNavMenuActionTypes.SetOrgNavMenu
  payload: OrgNavMenuState
}

export type OrgNavMenuAction = SetOrgNavMenuAction

export const setOrgNavMenu = (payload: OrgNavMenuState): SetOrgNavMenuAction => {
  if (payload.orgId) {
    try {
      window.localStorage.setItem(
        'cloudhub.orgNavMenu',
        JSON.stringify({
          orgId: payload.orgId,
          selection: payload.selection || {},
        })
      )
    } catch {
      // ignore
    }
  }

  return {
    type: OrgNavMenuActionTypes.SetOrgNavMenu,
    payload,
  }
}

export const readCachedOrgNavMenu = (): OrgNavMenuState => {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem('cloudhub.orgNavMenu') || 'null'
    )
    if (parsed?.orgId && parsed.selection && typeof parsed.selection === 'object') {
      return {orgId: parsed.orgId, selection: parsed.selection}
    }
  } catch {
    // ignore
  }
  return {orgId: null, selection: {}}
}

export const loadOrgNavMenuAsync = (orgId: string) => async (
  dispatch: (action: OrgNavMenuAction) => void
) => {
  if (!orgId) {
    return
  }

  try {
    const {data} = await getOrgNavMenu(orgId)
    const navItems = data && data.navItems ? data.navItems : []
    dispatch(
      setOrgNavMenu({
        orgId,
        selection: mapOrgNavItemsToSelection(navItems),
      })
    )
  } catch (error) {
    console.error(error)
    // Fail open: empty selection means menus stay visible by default.
    dispatch(
      setOrgNavMenu({
        orgId,
        selection: {},
      })
    )
  }
}
