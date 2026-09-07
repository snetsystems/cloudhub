import {
  OrgNavMenuAction,
  OrgNavMenuActionTypes,
  OrgNavMenuState,
  readCachedOrgNavMenu,
} from 'src/shared/actions/orgNavMenu'

const orgNavMenuReducer = (
  state: OrgNavMenuState = readCachedOrgNavMenu(),
  action: OrgNavMenuAction
): OrgNavMenuState => {
  switch (action.type) {
    case OrgNavMenuActionTypes.SetOrgNavMenu:
      return {
        orgId: action.payload.orgId,
        selection: action.payload.selection || {},
      }
    default:
      return state
  }
}

export default orgNavMenuReducer
