import {
  OrgNavMenuAction,
  OrgNavMenuActionTypes,
  OrgNavMenuState,
} from 'src/shared/actions/orgNavMenu'

const initialState: OrgNavMenuState = {
  orgId: null,
  selection: {},
}

const orgNavMenuReducer = (
  state: OrgNavMenuState = initialState,
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
