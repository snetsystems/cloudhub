import {useSelector} from 'react-redux'

import {ADMIN_ROLE} from 'src/auth/Authorized'
import {
  ensureRole,
  isRoleAuthorized,
  RouteGuardState,
} from 'src/auth/routeGuards'
import {isOrgNavMenuEnabled} from 'src/side_nav/utils/orgNavMenuVisibility'
import {Me} from 'src/types/auth'

/**
 * Role the AI features require. Everything below it — editor, viewer, member —
 * sees no AI menu, no AI button and cannot reach the AI routes by URL.
 */
export const AI_REQUIRED_ROLE = ADMIN_ROLE

/** Org nav menu id the whole AI section hangs off. */
export const AI_MENU_ID = 'ai-chat'

interface AiAccessState extends RouteGuardState {
  orgNavMenu?: {
    selection?: Record<string, boolean> | null
  } | null
}

/** Whether the signed-in user's role clears the AI bar. */
export const isAiRoleAuthorized = (
  me: Me | null | undefined,
  isUsingAuth: boolean | undefined
): boolean => isRoleAuthorized(me, isUsingAuth, AI_REQUIRED_ROLE)

/**
 * Role gate plus the per-org menu switch: both have to allow it before any AI
 * affordance is drawn.
 */
export const isAiChatVisible = (
  me: Me | null | undefined,
  isUsingAuth: boolean | undefined,
  selection: Record<string, boolean> | null | undefined
): boolean =>
  isAiRoleAuthorized(me, isUsingAuth) &&
  isOrgNavMenuEnabled(selection, AI_MENU_ID)

/**
 * Hook form for the AI entry points scattered across the monitoring screens
 * (server list, log analysis, traffic map, dashboard header).
 */
export const useAiChatAccess = (): boolean =>
  useSelector((state: AiAccessState) =>
    isAiChatVisible(
      state.auth?.me,
      state.auth?.isUsingAuth,
      state.orgNavMenu?.selection
    )
  )

/** react-router `onEnter` guard for the AI routes. */
export const ensureAiAuthorized = (
  getState: () => AiAccessState,
  homePage: string
) => ensureRole(getState, AI_REQUIRED_ROLE, homePage)
