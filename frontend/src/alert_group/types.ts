// frontend/src/alert_group/types.ts

export interface AlertCondition {
  level: 'critical' | 'warning' | 'info'
  value: string
  enabled: boolean
}

export interface AlertGroupRule {
  id?: string
  name: string
  database?: string
  retentionPolicy?: string
  measurement: string
  field: string
  conditions: AlertCondition[]
  triggerOperator:
    | 'greater'
    | 'greater_equal'
    | 'less'
    | 'less_equal'
    | 'equal'
    | 'not_equal'
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
  tickscript?: string
  orgId?: string
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
    {level: 'critical', value: '', enabled: true},
    {level: 'warning', value: '', enabled: true},
    {level: 'info', value: '', enabled: false},
  ],
  trigger: 'threshold',
  triggerValues: {
    change: 'change',
    shift: '1m',
    operator: 'greater than',
    value: '',
    period: '10m',
  },
  triggerOperator: 'greater',
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

export interface AlertTemplate {
  id: string
  name: string
  category: string
  measurement: string
  field: string
  defaultOperator?:
    | 'greater'
    | 'greater_equal'
    | 'less'
    | 'less_equal'
    | 'equal'
    | 'not_equal'
}

export const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: 'agent_data_timeout',
    name: 'Agent Data Timeout',
    category: 'System',
    measurement: 'system',
    field: 'uptime',
    defaultOperator: 'greater',
  },
  {
    id: 'cpu_usage',
    name: 'CPU 사용률',
    category: 'CPU',
    measurement: 'cpu',
    field: 'usage_percent',
    defaultOperator: 'greater',
  },
  {
    id: 'cpu_steal',
    name: 'CPU Steal',
    category: 'CPU',
    measurement: 'cpu',
    field: 'usage_steal',
    defaultOperator: 'greater',
  },
  {
    id: 'disk_usage',
    name: 'Disk 사용률',
    category: 'Disk',
    measurement: 'disk',
    field: 'used_percent',
    defaultOperator: 'greater',
  },
  {
    id: 'disk_io',
    name: 'Disk I/O',
    category: 'Disk',
    measurement: 'diskio',
    field: 'io_time',
    defaultOperator: 'greater',
  },
  {
    id: 'disk_inode',
    name: 'Disk Inode',
    category: 'Disk',
    measurement: 'disk',
    field: 'inodes_used',
    defaultOperator: 'greater',
  },
  {
    id: 'mem_usage',
    name: 'Memory 사용률',
    category: 'Memory',
    measurement: 'mem',
    field: 'used_percent',
    defaultOperator: 'greater',
  },
  {
    id: 'net_bps',
    name: 'Network BPS',
    category: 'Network',
    measurement: 'net',
    field: 'bytes_recv',
    defaultOperator: 'greater',
  },
  {
    id: 'net_iops',
    name: 'Network IOPS',
    category: 'Network',
    measurement: 'net',
    field: 'packets_recv',
    defaultOperator: 'greater',
  },
  {
    id: 'process_cpu',
    name: 'Process CPU',
    category: 'Process',
    measurement: 'processes',
    field: 'running',
    defaultOperator: 'greater',
  },
  {
    id: 'process_mem',
    name: 'Process Memory',
    category: 'Process',
    measurement: 'processes',
    field: 'blocked',
    defaultOperator: 'greater',
  },
  {
    id: 'swap_mem',
    name: 'Swap Memory',
    category: 'Memory',
    measurement: 'swap',
    field: 'used_percent',
    defaultOperator: 'greater',
  },
]

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
