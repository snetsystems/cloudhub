// frontend/src/alert_group/apis/index.ts
import AJAX from 'src/utils/ajax'
import {
  AlertGroupRule,
  AlertKapacitor,
  DEFAULT_RULE,
  UserGroup,
  OrganizationUserListItem,
  AlertGroupTestNotificationRequest,
  AlertGroupTestNotificationResponse,
} from 'src/alert_group/types'

interface AlertGroupRulesResponse {
  alertGroupRules: AlertGroupRule[]
}
interface UserGroupsResponse {
  userGroups: UserGroup[]
}

const normalizeAlertGroupRule = (
  rule: Partial<AlertGroupRule> | null | undefined
): AlertGroupRule => ({
  ...DEFAULT_RULE,
  ...(rule || {}),
  conditions: Array.isArray(rule?.conditions)
    ? rule.conditions
    : DEFAULT_RULE.conditions,
  hostnames: Array.isArray(rule?.hostnames) ? rule.hostnames : [],
  userGroupIds: Array.isArray(rule?.userGroupIds) ? rule.userGroupIds : [],
})

// Alert Group Rules
export const getAlertGroupRules = async (): Promise<AlertGroupRule[]> => {
  const {data} = await AJAX({
    method: 'GET',
    url: '/cloudhub/v2/alert-group-rules',
  })
  const rules = (data as AlertGroupRulesResponse).alertGroupRules || []
  return rules.map(normalizeAlertGroupRule)
}

export const getAlertGroupRule = async (
  id: string
): Promise<AlertGroupRule> => {
  const {data} = await AJAX({
    method: 'GET',
    url: `/cloudhub/v2/alert-group-rules/${id}`,
  })
  return normalizeAlertGroupRule(data as Partial<AlertGroupRule>)
}

export const createAlertGroupRule = async (
  rule: AlertGroupRule
): Promise<AlertGroupRule> => {
  const {data} = await AJAX({
    method: 'POST',
    url: '/cloudhub/v2/alert-group-rules',
    data: rule,
  })
  return normalizeAlertGroupRule(data as Partial<AlertGroupRule>)
}

export const updateAlertGroupRule = async (
  id: string,
  rule: AlertGroupRule
): Promise<AlertGroupRule> => {
  const {data} = await AJAX({
    method: 'PATCH',
    url: `/cloudhub/v2/alert-group-rules/${id}`,
    data: rule,
  })
  return normalizeAlertGroupRule(data as Partial<AlertGroupRule>)
}

export const testDraftAlertGroupNotification = async (
  payload: AlertGroupTestNotificationRequest
): Promise<AlertGroupTestNotificationResponse> => {
  const {data} = await AJAX({
    method: 'POST',
    url: '/cloudhub/v2/alert-group-rules/test-notification',
    data: payload,
  })
  return data as AlertGroupTestNotificationResponse
}

export const testSavedAlertGroupNotification = async (
  id: string,
  payload: Pick<
    AlertGroupTestNotificationRequest,
    'title' | 'message' | 'recipients' | 'userGroupIds'
  >
): Promise<AlertGroupTestNotificationResponse> => {
  const {data} = await AJAX({
    method: 'POST',
    url: `/cloudhub/v2/alert-group-rules-test-notification/${id}`,
    data: payload,
  })
  return data as AlertGroupTestNotificationResponse
}

export const deleteAlertGroupRule = async (id: string): Promise<void> => {
  await AJAX({
    method: 'DELETE',
    url: `/cloudhub/v2/alert-group-rules/${id}`,
  })
}

interface AlertKapacitorsResponse {
  alertKapacitors: AlertKapacitor[]
}

// Dropdown data — Alert Group은 v2 alert_kapacitors만 사용
export const getAlertKapacitors = async (): Promise<AlertKapacitor[]> => {
  const {data} = await AJAX({
    method: 'GET',
    url: '/cloudhub/v2/alert-kapacitors',
  })
  const kapacitors = (data as AlertKapacitorsResponse).alertKapacitors || []
  return kapacitors.map(k => ({
    id: String(k.id),
    name: k.name,
    url: k.url,
    orgId: k.orgId,
  }))
}

// User Group CRUD
export const getUserGroups = async (): Promise<UserGroup[]> => {
  const {data} = await AJAX({
    method: 'GET',
    url: '/cloudhub/v2/user-groups',
  })
  return (data as UserGroupsResponse).userGroups || []
}

export const getUserGroup = async (id: string): Promise<UserGroup> => {
  const {data} = await AJAX({
    method: 'GET',
    url: `/cloudhub/v2/user-groups/${id}`,
  })
  return data as UserGroup
}

export const createUserGroup = async (group: UserGroup): Promise<UserGroup> => {
  const {data} = await AJAX({
    method: 'POST',
    url: '/cloudhub/v2/user-groups',
    data: group,
  })
  return data as UserGroup
}

export const updateUserGroup = async (
  id: string,
  group: UserGroup
): Promise<void> => {
  await AJAX({
    method: 'PATCH',
    url: `/cloudhub/v2/user-groups/${id}`,
    data: group,
  })
}

export const deleteUserGroup = async (id: string): Promise<void> => {
  await AJAX({
    method: 'DELETE',
    url: `/cloudhub/v2/user-groups/${id}`,
  })
}

// Alert Rule ↔ hosts
export const setAlertRuleHosts = async (
  ruleId: string,
  hostnames: string[]
): Promise<void> => {
  await AJAX({
    method: 'PUT',
    url: `/cloudhub/v2/alert-group-rules/${ruleId}/hosts`,
    data: {hostnames},
  })
}

export const getSystemUsers = async (): Promise<any[]> => {
  // Use links if available, but as fallback use static org users endpoint or system global
  // Normally /cloudhub/v1/users is for superAdmin, but let's try the common endpoint.
  const {data} = await AJAX({
    method: 'GET',
    url: '/cloudhub/v1/users',
  })
  return data.users || []
}

export const getOrganizationUsers = async (
  orgId: string
): Promise<OrganizationUserListItem[]> => {
  if (!orgId) {
    return []
  }
  const {data} = await AJAX({
    method: 'GET',
    url: `/cloudhub/v1/organizations/${encodeURIComponent(orgId)}/users`,
  })
  const users = (data as {users?: Record<string, unknown>[]}).users || []
  return users.map(u => ({
    id: String(u.id ?? ''),
    name: String(u.name ?? ''),
    email: u.email != null ? String(u.email) : undefined,
  }))
}
