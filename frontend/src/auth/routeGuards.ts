import {isUserAuthorized} from 'src/auth/Authorized'
import {Me} from 'src/types/auth'

export interface RouteGuardState {
  auth?: {
    me?: Me | null
    isUsingAuth?: boolean
  }
}

/**
 * Whether the signed-in user clears `requiredRole`.
 *
 * Only an explicit `isUsingAuth === false` counts as "this deployment has auth
 * turned off". While the flag is still undefined we fall through to the role
 * check, which fails closed rather than briefly treating everyone as an admin.
 */
export const isRoleAuthorized = (
  me: Me | null | undefined,
  isUsingAuth: boolean | undefined,
  requiredRole: string
): boolean => {
  if (isUsingAuth === false) {
    return true
  }

  return isUserAuthorized(me?.role, requiredRole)
}

/**
 * react-router `onEnter` guard: sends a user who is below `requiredRole` to
 * their home page instead of rendering the route.
 *
 * Hiding a nav item is not a control on its own — without a guard here the
 * page is still one typed URL away. Safe to run at mount time: the router is
 * only rendered once `checkAuth()` has resolved, so `auth` is populated.
 *
 * `homePage` is handed in rather than read from src/shared/constants, which
 * drags the whole type index into every module that imports a guard.
 */
export const ensureRole = (
  getState: () => RouteGuardState,
  requiredRole: string,
  homePage: string
) => (
  nextState: {params?: {sourceID?: string}},
  replace: (path: string) => void
): void => {
  const {auth} = getState()

  if (isRoleAuthorized(auth?.me, auth?.isUsingAuth, requiredRole)) {
    return
  }

  const sourceID = nextState?.params?.sourceID

  replace(sourceID ? `/sources/${sourceID}/${homePage}` : `/${homePage}`)
}
