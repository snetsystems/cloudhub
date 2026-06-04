// frontend/src/alert_group/apis/index.ts
import AJAX from 'src/utils/ajax'
import {proxy} from 'src/utils/queryUrlGenerator'
import {Source} from 'src/types'
import {
  AlertGroupRule,
  AlertRuleEventHandler,
  AlertKapacitor,
  AlertTemplate,
  DEFAULT_RULE,
  AlertGroupTestNotificationRequest,
  AlertGroupTestNotificationResponse,
  RecipientGroup,
  RecipientGroupMember,
  AlertRecipientGroup,
  AlertRecipientMemberPrefs,
  UserGroup,
  UserGroupMember,
  OrganizationUserListItem,
} from 'src/types'

interface AlertGroupRulesResponse {
  alertGroupRules: AlertGroupRule[]
}
interface RecipientGroupsResponse {
  recipientGroups: RecipientGroup[]
}

const normalizeAlertGroupRule = (
  rule: Partial<AlertGroupRule> | null | undefined
): AlertGroupRule => {
  const emailHandler = Array.isArray(rule?.eventHandlers)
    ? rule?.eventHandlers.find(handler => handler.type === 'email')
    : undefined
  const recipientGroupIds = Array.isArray(emailHandler?.recipientGroupIds)
    ? emailHandler?.recipientGroupIds || []
    : Array.isArray(rule?.recipientGroupIds)
    ? rule.recipientGroupIds
    : []

  return {
    ...DEFAULT_RULE,
    ...(rule || {}),
    values: {
      ...DEFAULT_RULE.values,
      ...(rule?.values || {}),
    },
    conditions: Array.isArray(rule?.conditions)
      ? rule.conditions.map(condition => ({
          ...condition,
          value: String(condition.value),
          operator: condition.operator || 'greater',
        }))
      : DEFAULT_RULE.conditions,
    hostnames: Array.isArray(rule?.hostnames) ? rule.hostnames : [],
    recipientGroupIds,
    eventHandlers: Array.isArray(rule?.eventHandlers) ? rule.eventHandlers : [],
  }
}

const toEmailEventHandlers = (
  recipientGroupIds: string[],
  existingEmailHandler?: AlertRuleEventHandler
): AlertRuleEventHandler[] => [
  {
    ...(existingEmailHandler || {}),
    type: 'email',
    enabled: existingEmailHandler?.enabled ?? true,
    recipientGroupIds: recipientGroupIds || [],
    configJson: existingEmailHandler?.configJson || {to: [], body: ''},
  },
]

const toAlertRuleEventHandlers = (rule: AlertGroupRule) => {
  const nonEmailHandlers = Array.isArray(rule.eventHandlers)
    ? rule.eventHandlers.filter(handler => handler.type !== 'email')
    : []
  const emailHandler = Array.isArray(rule.eventHandlers)
    ? rule.eventHandlers.find(handler => handler.type === 'email')
    : undefined

  if (!emailHandler) {
    return nonEmailHandlers
  }

  return [
    ...nonEmailHandlers,
    ...toEmailEventHandlers(rule.recipientGroupIds, emailHandler),
  ]
}

const toAlertGroupRuleRequest = (rule: AlertGroupRule) => {
  const {recipientGroupIds, eventHandlers, ...rest} = rule

  let cleanedValues: AlertGroupRule['values'] = {}
  if (rule.trigger === 'relative') {
    cleanedValues = {
      change: rule.values?.change || 'change',
      shift: rule.values?.shift || '1m',
    }
  } else if (rule.trigger === 'deadman') {
    cleanedValues = {
      period: rule.values?.period || '10m',
    }
  } else {
    cleanedValues = {}
  }

  return {
    ...rest,
    values: cleanedValues,
    eventHandlers: toAlertRuleEventHandlers(rule),
    conditions: (rule.conditions || []).map(condition => ({
      ...condition,
      value: Number(condition.value),
    })),
  }
}

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
    data: toAlertGroupRuleRequest(rule),
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
    data: toAlertGroupRuleRequest(rule),
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
    'title' | 'message' | 'recipientGroupIds' | 'recipients' | 'includeSelf'
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

export const deleteAlertGroupRuleAndFetch = async (
  id: string
): Promise<AlertGroupRule[]> => {
  await deleteAlertGroupRule(id)
  return await getAlertGroupRules()
}

// Alert Rule event handlers
export const setAlertRuleRecipientGroups = async (
  ruleId: string,
  recipientGroupIds: string[]
): Promise<void> => {
  await AJAX({
    method: 'PUT',
    url: `/cloudhub/v2/alert-group-rules/${ruleId}/event-handlers`,
    data: {eventHandlers: toEmailEventHandlers(recipientGroupIds)},
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

// Recipient Group CRUD (Layer 1 — domain-neutral)
export const getRecipientGroups = async (): Promise<RecipientGroup[]> => {
  const {data} = await AJAX({
    method: 'GET',
    url: '/cloudhub/v2/recipient-groups',
  })
  return (data as RecipientGroupsResponse).recipientGroups || []
}

export const getRecipientGroup = async (
  id: string
): Promise<RecipientGroup> => {
  const {data} = await AJAX({
    method: 'GET',
    url: `/cloudhub/v2/recipient-groups/${id}`,
  })
  return data as RecipientGroup
}

export const createRecipientGroup = async (
  name: string
): Promise<RecipientGroup> => {
  const {data} = await AJAX({
    method: 'POST',
    url: '/cloudhub/v2/recipient-groups',
    data: {name},
  })
  return data as RecipientGroup
}

export const updateRecipientGroup = async (
  id: string,
  name: string
): Promise<RecipientGroup> => {
  const {data} = await AJAX({
    method: 'PATCH',
    url: `/cloudhub/v2/recipient-groups/${id}`,
    data: {name},
  })
  return data as RecipientGroup
}

export const deleteRecipientGroup = async (id: string): Promise<void> => {
  await AJAX({
    method: 'DELETE',
    url: `/cloudhub/v2/recipient-groups/${id}`,
  })
}

// Recipient Group Members
export const addRecipientGroupMember = async (
  groupId: string,
  member: Pick<
    RecipientGroupMember,
    'userId' | 'userName' | 'email' | 'phoneNumber' | 'isExternal'
  >
): Promise<RecipientGroupMember> => {
  const {data} = await AJAX({
    method: 'POST',
    url: `/cloudhub/v2/recipient-groups/${groupId}/members`,
    data: member,
  })
  return data as RecipientGroupMember
}

export const updateRecipientGroupMember = async (
  groupId: string,
  memberId: string,
  patch: Partial<
    Pick<RecipientGroupMember, 'userName' | 'email' | 'phoneNumber'>
  >
): Promise<RecipientGroupMember> => {
  const {data} = await AJAX({
    method: 'PATCH',
    url: `/cloudhub/v2/recipient-groups/${groupId}/members/${memberId}`,
    data: patch,
  })
  return data as RecipientGroupMember
}

export const deleteRecipientGroupMember = async (
  groupId: string,
  memberId: string
): Promise<void> => {
  await AJAX({
    method: 'DELETE',
    url: `/cloudhub/v2/recipient-groups/${groupId}/members/${memberId}`,
  })
}

// Alert Recipient Group policy (Layer 2 — alert-domain suppression)
export const getAlertRecipientGroupPolicy = async (
  groupId: string
): Promise<AlertRecipientGroup> => {
  const {data} = await AJAX({
    method: 'GET',
    url: `/cloudhub/v2/recipient-groups/${groupId}/alert-policy`,
  })
  return data as AlertRecipientGroup
}

export const upsertAlertRecipientGroupPolicy = async (
  groupId: string,
  policy: Omit<
    AlertRecipientGroup,
    'recipientGroupId' | 'createdAt' | 'updatedAt'
  >
): Promise<AlertRecipientGroup> => {
  const {data} = await AJAX({
    method: 'PUT',
    url: `/cloudhub/v2/recipient-groups/${groupId}/alert-policy`,
    data: policy,
  })
  return data as AlertRecipientGroup
}

export const deleteAlertRecipientGroupPolicy = async (
  groupId: string
): Promise<void> => {
  await AJAX({
    method: 'DELETE',
    url: `/cloudhub/v2/recipient-groups/${groupId}/alert-policy`,
  })
}

// Member alert prefs (channel / level / window)
interface AlertRecipientMemberPrefsListResponse {
  alertRecipientMemberPrefs: AlertRecipientMemberPrefs[]
}

// Bulk fetch — returns prefs for every member of the group in one round-trip,
// avoiding N+1 calls when rendering per-member channel toggles.
export const getAlertRecipientMemberPrefsByGroup = async (
  groupId: string
): Promise<AlertRecipientMemberPrefs[]> => {
  const {data} = await AJAX({
    method: 'GET',
    url: `/cloudhub/v2/recipient-groups/${groupId}/alert-prefs`,
  })
  return (
    (data as AlertRecipientMemberPrefsListResponse).alertRecipientMemberPrefs ||
    []
  )
}

// Bulk upsert — applies a batch of member prefs in one transaction.
// Members not present in `prefs` keep their existing prefs (partial save UX).
// Each entry's recipientGroupMemberId must belong to `groupId` — the server
// rejects cross-group ids with 400.
export const upsertAlertRecipientMemberPrefsByGroup = async (
  groupId: string,
  prefs: AlertRecipientMemberPrefs[]
): Promise<AlertRecipientMemberPrefs[]> => {
  const {data} = await AJAX({
    method: 'PUT',
    url: `/cloudhub/v2/recipient-groups/${groupId}/alert-prefs`,
    data: {alertRecipientMemberPrefs: prefs},
  })
  return (
    (data as AlertRecipientMemberPrefsListResponse).alertRecipientMemberPrefs ||
    []
  )
}

export const getAlertRecipientMemberPrefs = async (
  memberId: string
): Promise<AlertRecipientMemberPrefs> => {
  const {data} = await AJAX({
    method: 'GET',
    url: `/cloudhub/v2/recipient-group-members/${memberId}/alert-prefs`,
  })
  return data as AlertRecipientMemberPrefs
}

export const upsertAlertRecipientMemberPrefs = async (
  memberId: string,
  prefs: Omit<AlertRecipientMemberPrefs, 'recipientGroupMemberId'>
): Promise<AlertRecipientMemberPrefs> => {
  const {data} = await AJAX({
    method: 'PUT',
    url: `/cloudhub/v2/recipient-group-members/${memberId}/alert-prefs`,
    data: prefs,
  })
  return data as AlertRecipientMemberPrefs
}

// Legacy UserGroup-shaped adapter — bridges Recipient Group API to
// existing UI (BasicSection / UserGroupMemberSettings) until those
// components are rewritten against the new contracts.
// Per-member email/sms prefs default to {emailEnabled:false, emailLevel:'all'};
// real prefs live in AlertRecipientMemberPrefs (load per memberId on demand).
const adaptRecipientMemberToUserGroupMember = (
  m: RecipientGroupMember
): UserGroupMember => ({
  userId: m.userId,
  userName: m.userName,
  email: m.email,
  emailEnabled: false,
  emailLevel: 'all',
  sms: m.phoneNumber || undefined,
  smsEnabled: false,
  smsLevel: 'all',
})

const adaptRecipientGroupToUserGroup = (g: RecipientGroup): UserGroup => ({
  id: g.id,
  orgId: g.orgId,
  name: g.name,
  alertNodes: {},
  members: (g.members || []).map(adaptRecipientMemberToUserGroupMember),
  notifyDays: '',
  notifyStartHm: '',
  notifyEndHm: '',
  receiveLevel: 'all',
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
})

export const getUserGroups = async (): Promise<UserGroup[]> => {
  const groups = await getRecipientGroups()
  return groups.map(adaptRecipientGroupToUserGroup)
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

// Builtin alert templates (Layer 0 — read-only blueprints).
interface AlertTemplatesResponse {
  alertTemplates: AlertTemplate[]
}

export const getAlertTemplates = async (): Promise<AlertTemplate[]> => {
  const {data} = await AJAX({
    method: 'GET',
    url: '/cloudhub/v2/alert-templates',
  })
  return (data as AlertTemplatesResponse | undefined)?.alertTemplates || []
}

// fetchAvailableMeasurements runs `SHOW MEASUREMENTS` against the source's
// default telegraf DB and returns the set of measurement names. Used by the
// template sidebar to disable templates whose measurement is not collected
// in the current environment (e.g. `procstat` not installed → process_*
// templates render as disabled with a tooltip).
//
// Returns an empty set on error so the UI degrades gracefully — templates
// remain disabled but visible.
export const fetchAvailableMeasurements = async (
  source: Source,
  db?: string
): Promise<Set<string>> => {
  const database = db || source.telegraf || 'telegraf'
  try {
    const {data} = await proxy({
      source: source.links.proxy,
      query: 'SHOW MEASUREMENTS',
      db: database,
    })
    const results = (data as {results?: any[]})?.results
    const rows: any[][] = results?.[0]?.series?.[0]?.values || []
    return new Set(rows.map(r => String(r[0])))
  } catch {
    return new Set()
  }
}
