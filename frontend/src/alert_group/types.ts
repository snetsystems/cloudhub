export type AlertConditionOperator =
  | 'greater'
  | 'greater_equal'
  | 'less'
  | 'less_equal'
  | 'equal'
  | 'not_equal'

export interface AlertCondition {
  level: 'critical' | 'warning' | 'info'
  value: string
  operator?: AlertConditionOperator
  enabled: boolean
  operator?:
    | 'greater'
    | 'greater_equal'
    | 'less'
    | 'less_equal'
    | 'equal'
    | 'not_equal'
}

// DerivativeConfig — when enabled, the backend tickscript inserts
// |derivative('<field>').[nonNegative()].unit(<unit>) between |from() and the
// alert pipeline. Result field name equals the input field, so threshold
// lambdas continue to reference rule.field unchanged.
export interface DerivativeConfig {
  enabled: boolean
  nonNegative: boolean
  unit: string // duration literal like "1s"
}

// EvalConfig — when both expression and `as` are non-empty, the backend
// tickscript inserts |eval(lambda: <expression>).as('<as>').keep(). Threshold
// lambdas reference `as` instead of rule.field.
export interface EvalConfig {
  expression: string
  as: string
}

export interface AlertGroupRule {
  id?: string
  name: string
  database?: string
  retentionPolicy?: string
  measurement: string
  field: string
  conditions: AlertCondition[]
  taskType: string
  every: string
  occurrenceType: 'consecutive' | 'recent' | 'total'
  occurrenceCount: number
  occurrenceWindow: string
  pauseSeconds: number
  notifyRecovery: boolean
  message: string
  trigger: 'threshold' | 'relative' | 'deadman'
  triggerValues?: {
    change?: string
    shift?: string
    operator?: string
    value?: string
    period?: string
  }
  values?: {
    change?: string
    shift?: string
    operator?: string
    value?: string
    period?: string
  }
  active: boolean
  kapacitorId: string
  hostnames: string[]
  recipientGroupIds: string[]
  eventHandlers?: AlertRuleEventHandler[]
  // Optional TICK transformations between |from() and the alert pipeline.
  // Templates set these; users can override via raw mode (future UI).
  derivative?: DerivativeConfig
  eval?: EvalConfig
  tickscript?: string
  orgId?: string
  createdAt?: string
  updatedAt?: string
}

export interface AlertRuleEventHandler {
  id?: string
  alertRuleId?: string
  type:
    | 'email'
    | 'sms'
    | 'webhook'
    | 'tcp'
    | 'exec'
    | 'log'
    | 'slack'
    | 'kafka'
    | 'telegram'
  enabled: boolean
  configJson?: Record<string, unknown>
  recipientGroupIds: string[]
  createdAt?: string
  updatedAt?: string
}

export interface AlertKapacitor {
  id: string
  name: string
  url: string
  orgId: string
}

export interface AlertGroupTestNotificationRequest {
  kapacitorId?: string
  recipientGroupIds?: string[]
  title: string
  message: string
}

export interface AlertGroupTestNotificationResponse {
  resolvedRecipientGroups: number
  resolvedRecipients: string[]
  sentCount: number
}

// Layer 1 (domain-neutral) recipient grouping. Mirrors backend cloudhub.RecipientGroup.
export interface RecipientGroup {
  id: string
  orgId: string
  name: string
  isDefault?: boolean
  deleteYn?: boolean
  createdAt?: string
  updatedAt?: string
  members?: RecipientGroupMember[]
}

export interface RecipientGroupMember {
  id: string
  recipientGroupId: string
  userId: string
  userName: string
  email: string
  phoneNumber: string
  isExternal?: boolean
  deleteYn?: boolean
  createdAt?: string
  updatedAt?: string
}

// Layer 2 alert-domain extension keyed by RecipientGroup.id.
export interface AlertRecipientGroup {
  recipientGroupId: string
  suppressionEnabled: boolean
  suppressionWindowSeconds: number
  suppressionCount: number
  suppressionPauseSeconds: number
  createdAt?: string
  updatedAt?: string
}

// Layer 2 alert-domain extension keyed by RecipientGroupMember.id.
export interface AlertRecipientMemberPrefs {
  recipientGroupMemberId: string
  emailEnabled: boolean
  emailLevel: string
  smsEnabled: boolean
  smsLevel: string
  notifyWeekdays: string
  notifyStartHm: string
  notifyEndHm: string
  escalationSeconds: number
}

export interface HostCandidate {
  hostname: string
}

export interface OrganizationUserListItem {
  id: string
  name: string
  email?: string
}

export interface AlertNodeEmail {
  to: string[]
}

export interface AlertNodeSlack {
  workspace: string
  channel: string
}

export interface AlertNodePost {
  url: string
}

export interface AlertNodes {
  email?: AlertNodeEmail[]
  slack?: AlertNodeSlack[]
  post?: AlertNodePost[]
}

export interface UserGroupMember {
  userId: string
  userName: string
  email?: string
  emailEnabled: boolean
  emailLevel: string
  sms?: string
  smsEnabled: boolean
  smsLevel: string
  language?: string
  notifyDays?: string
  notifyStartHm?: string
  notifyEndHm?: string
}

export interface UserGroup {
  id?: string
  orgId?: string
  name: string
  alertNodes: AlertNodes
  members: UserGroupMember[]
  notifyDays: string
  notifyStartHm: string
  notifyEndHm: string
  receiveLevel: 'all' | 'warning' | 'critical'
  createdAt?: string
  updatedAt?: string
}

export const DEFAULT_RULE: AlertGroupRule = {
  name: '',
  database: '',
  retentionPolicy: '',
  measurement: '',
  field: '',
  conditions: [
    {level: 'critical', value: '', enabled: true, operator: 'greater'},
    {level: 'warning', value: '', enabled: true, operator: 'greater'},
    {level: 'info', value: '', enabled: false, operator: 'greater'},
  ],
  trigger: 'threshold',
  triggerValues: {
    change: 'change',
    shift: '1m',
    operator: 'greater than',
    value: '',
    period: '10m',
  },
  taskType: 'stream',
  every: '30s',
  occurrenceType: 'consecutive',
  occurrenceCount: 1,
  occurrenceWindow: '5m',
  pauseSeconds: 0,
  notifyRecovery: false,
  message: '',
  active: true,
  kapacitorId: '',
  hostnames: [],
  recipientGroupIds: [],
}

// AlertTemplate matches backend cloudhub.AlertTemplate — a complete blueprint
// for creating an AlertGroupRule. Loaded from /cloudhub/v2/alert-templates.
export interface AlertTemplate {
  id: string
  name: string
  description?: string
  category?: string // monitoring domain: server-monitoring | url-monitoring | ...
  tags?: string[]
  database: string
  retentionPolicy: string
  measurement: string
  field: string
  derivative?: DerivativeConfig
  eval?: EvalConfig
  trigger?: 'threshold' | 'relative' | 'deadman'
  values?: AlertGroupRule['triggerValues']
  taskType: string
  every: string
  occurrenceType: AlertGroupRule['occurrenceType']
  occurrenceCount: number
  occurrenceWindow: string
  pauseSeconds: number
  notifyRecovery: boolean
  message: string
  emailBody?: string
  conditions?: AlertCondition[]
}

export const TRIGGER_OPERATORS = [
  {label: '초과 (>)', value: 'greater'},
  {label: '이상 (>=)', value: 'greater_equal'},
  {label: '미만 (<)', value: 'less'},
  {label: '이하 (<=)', value: 'less_equal'},
  {label: '같음 (=)', value: 'equal'},
  {label: '다름 (!=)', value: 'not_equal'},
]

export const PAUSE_SECONDS_OPTIONS = [
  {label: '사용 안 함', value: 0},
  {label: '5분', value: 300},
  {label: '10분', value: 600},
  {label: '30분', value: 1800},
  {label: '1시간', value: 3600},
]
