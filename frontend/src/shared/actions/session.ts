import {Dispatch} from 'redux'
import {errorThrown} from 'src/shared/actions/errors'
import {HTTP_FORBIDDEN} from 'src/shared/constants'
import {Me} from 'src/types/auth'
import {
  indexRole,
  VIEWER_ROLE,
  EDITOR_ROLE,
  ADMIN_ROLE,
  SUPERADMIN_ROLE,
} from 'src/auth/Authorized'

interface Auth {
  auth: {
    isUsingAuth: boolean
    me: Me
    links: {
      me: string
    }
  }
}

export type UserRole =
  | typeof VIEWER_ROLE
  | typeof EDITOR_ROLE
  | typeof ADMIN_ROLE
  | typeof SUPERADMIN_ROLE

export const ForceSessionAbort = ({auth}: Auth) => async (
  dispatch: Dispatch<any>
) => {
  let err: any = {
    auth,
    status: HTTP_FORBIDDEN,
    statusText: 'No Authorized: This approach is not allowed.',
    message: 'No Authorized',
    data: {
      message: 'This approach is not allowed.',
    },
  }

  dispatch(errorThrown(err))
}

export const ForceSessionAbortInputRole = (
  requireRole: UserRole,
  isNoAuthOuting: boolean = false
) => (dispatch: Dispatch<any>, getState: any) => {
  const {auth} = getState()
  const {
    me: {role: meRole},
    isUsingAuth,
  } = auth

  if (isUsingAuth) {
    const meRoleIndex = indexRole.indexOf(meRole)
    const requireRoleIndex = indexRole.indexOf(requireRole)

    if (requireRoleIndex >= 0) {
      if (meRoleIndex >= requireRoleIndex) {
        return ForceSessionAbort({auth})(dispatch)
      }
    }
  } else {
    if (isNoAuthOuting) {
      this.props.route('/state')
      return ForceSessionAbort({auth})(dispatch)
    }
  }
}
