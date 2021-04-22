import _ from 'lodash'

import {isSameUser} from 'shared/reducers/helpers/auth'

const initialState = {
  users: [],
  organizations: [],
  mappings: [],
  authConfig: {
    superAdminNewUsers: false,
  },
}

const adminCloudHub = (state = initialState, action) => {
  switch (action.type) {
    case 'CLOUDHUB_LOAD_USERS': {
      return {...state, ...action.payload}
    }

    case 'CLOUDHUB_LOAD_ORGANIZATIONS': {
      return {...state, ...action.payload}
    }

    case 'CLOUDHUB_ADD_USER': {
      const {user} = action.payload
      return {...state, users: [...state.users, user]}
    }

    case 'CLOUDHUB_UPDATE_USER': {
      const {user, updatedUser} = action.payload
      return {
        ...state,
        users: state.users.map((u) =>
          u.links.self === user.links.self ? {...updatedUser} : u
        ),
      }
    }
    case 'CLOUDHUB_SYNC_USER': {
      const {staleUser, syncedUser} = action.payload
      return {
        ...state,
        users: state.users.map(
          // stale user does not have links, so uniqueness is on name, provider, & scheme
          (u) => (isSameUser(u, staleUser) ? {...syncedUser} : u)
        ),
      }
    }

    case 'CLOUDHUB_REMOVE_USER': {
      const {user} = action.payload
      return {
        ...state,
        // stale user does not necessarily have links, so uniqueness is on name,
        // provider, & scheme, except for a created users that is a duplicate
        // of an existing user, in which case a temp uuid is used to match
        users: state.users.filter((u) =>
          user._tempID ? u._tempID !== user._tempID : u.id !== user.id
        ),
      }
    }

    case 'CLOUDHUB_ADD_ORGANIZATION': {
      const {organization} = action.payload
      return {
        ...state,
        organizations: [organization, ...state.organizations],
      }
    }

    case 'CLOUDHUB_RENAME_ORGANIZATION': {
      const {organization, newName} = action.payload
      return {
        ...state,
        organizations: state.organizations.map((o) =>
          o.links.self === organization.links.self ? {...o, name: newName} : o
        ),
      }
    }

    case 'CLOUDHUB_SYNC_ORGANIZATION': {
      const {staleOrganization, syncedOrganization} = action.payload
      return {
        ...state,
        organizations: state.organizations.map((o) =>
          o.name === staleOrganization.name ? {...syncedOrganization} : o
        ),
      }
    }

    case 'CLOUDHUB_REMOVE_ORGANIZATION': {
      const {organization} = action.payload
      return {
        ...state,
        organizations: state.organizations.filter((o) =>
          organization._tempID
            ? o._tempID !== organization._tempID
            : o.id !== organization.id
        ),
      }
    }

    case 'CLOUDHUB_LOAD_MAPPINGS': {
      const {mappings} = action.payload
      return {
        ...state,
        mappings,
      }
    }

    case 'CLOUDHUB_UPDATE_MAPPING': {
      const {staleMapping, updatedMapping} = action.payload
      return {
        ...state,
        mappings: state.mappings.map((m) =>
          replaceMapping(m, staleMapping, updatedMapping)
        ),
      }
    }

    case 'CLOUDHUB_ADD_MAPPING': {
      const {mapping} = action.payload
      return {
        ...state,
        mappings: [...state.mappings, mapping],
      }
    }

    case 'CLOUDHUB_REMOVE_MAPPING': {
      const {mapping} = action.payload
      return {
        ...state,
        mappings: state.mappings.filter((m) =>
          mapping._tempID ? m._tempID !== mapping._tempID : m.id !== mapping.id
        ),
      }
    }

    case 'CLOUDHUB_LOCK_CHANGE_USER': {
      const {name, locked} = action.payload

      return {
        ...state,
        users: _.map(state.users, (user) =>
          user.name === name ? {...user, locked} : user
        ),
      }
    }
  }

  return state
}

function replaceMapping(m, staleMapping, updatedMapping) {
  if (staleMapping._tempID && m._tempID === staleMapping._tempID) {
    return {...updatedMapping}
  } else if (m.id === staleMapping.id) {
    return {...updatedMapping}
  }
  return m
}

export default adminCloudHub
