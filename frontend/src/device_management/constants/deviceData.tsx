import {
  AlertRule,
  DeviceData,
  DropdownItem,
  LearningOption,
  SNMPConfig,
  SSHConfig,
} from 'src/types'

export const DEFAULT_SNMP_CONFIG: SNMPConfig = {
  community: '',
  port: 161,
  version: '1',
  protocol: 'UDP',
}

export const DEFAULT_SSH_CONFIG: SSHConfig = {
  user_id: '',
  password: '',
  en_password: '',
  port: 22,
}

export const DEFAULT_NETWORK_DEVICE_DATA: DeviceData = {
  device_ip: '',
  organization: 'Default',
  snmp_config: DEFAULT_SNMP_CONFIG,
  ssh_config: DEFAULT_SSH_CONFIG,
}

export const SNMP_VERSION: DropdownItem[] = [{text: '1'}, {text: '2c'}]

export const SNMP_PROTOCOL: DropdownItem[] = [
  {text: 'UDP'},
  {text: 'UDP4'},
  {text: 'UDP6'},
  {text: 'TCP'},
  {text: 'TCP4'},
  {text: 'TCP6'},
]

export const IMPORT_DEVICE_CSV_Template =
  'device_ip,organization,snmp_community,snmp_port,snmp_version,snmp_protocol,ssh_user_id,ssh_password,ssh_en_password,ssh_port'

export const SNMP_CONNECTION_URL = '/cloudhub/v1/snmp/validation'

export const DEVICE_MANAGEMENT_URL =
  '/cloudhub/v1/ai/network/managements/devices'

export const APPLY__MONITORING_URL =
  '/cloudhub/v1/ai/network/managements/monitoring/config'

export const APPLY_LEARNING_ENABLE_STATUS_URL =
  '/cloudhub/v1/ai/network/managements/learning/config'

export const DELETE_MODAL_INFO = {
  message: `Are you sure you want to delete this?`,
}

export const SYSTEM_MODAL = {
  LEARNING: 'learning',
  DELETE: 'delete',
  MONITORING_DELETE: 'monitoring_delete',
} as const

export const MLFunctionMsg = {
  ml_multiplied: 'Correlation Coefficient',
  ml_scaling_normalized: 'Scaling Normalized',
  ml_gaussian_std: 'Gaussian Standard Deviation',
} as const

export const PREDICT_MODE = {
  ML: 'ML',
  DL: 'DL',
  EnsembleOrCondition: 'Ensemble (ML or DL)',
  EnsembleAndCondition: 'Ensemble (ML and DL)',
} as const

export const DEFAULT_PREDICT_MODE = 'ML'

export const DEFAULT_LEARNING_OPTION: LearningOption = {
  organization: '',
  data_duration: 15,
  ml_function: 'ml_gaussian_std' as typeof MLFunctionMsg[keyof typeof MLFunctionMsg],
}

export const DEFAULT_CRON_SCHEDULE = '1 0 1,15 * *'

export const NETWORK_MANAGEMENT_ORGANIZATIONS_URL =
  '/cloudhub/v1/ai/network/managements/orgs'

export const DEVICE_MANAGEMENT_SCRIPT_URL =
  '/cloudhub/v1/ai/network/managements/script/org'

export const LEARN_TASK_PREFIX = 'learn-'
export const PREDICT_TASK_PREFIX = 'predict-'

export const DEFAULT_KAPACITOR = {
  url: '',
  name: '',
  active: false,
  insecureSkipVerify: false,
}

export const DEFAULT_TASK = {
  id: '',
  name: '',
  status: '',
  tickscript: '',
  dbrps: [],
  type: '',
}

export const DEFAULT_ALERT_RULE: AlertRule = {
  id: 'DEFAULT_RULE_ID',
  tickscript: '',
  every: 'null',
  alertNodes: {
    stateChangesOnly: false,
    useFlapping: false,
    post: [],
    tcp: [],
    email: [],
    exec: [],
    log: [],
    victorOps: [],
    pagerDuty: [],
    pagerDuty2: [],
    pushover: [],
    sensu: [],
    slack: [],
    telegram: [],
    alerta: [],
    opsGenie: [],
    opsGenie2: [],
    talk: [],
  },
  message: '',
  details: '',
  trigger: '',
  values: {
    operator: '',
    value: '',
    rangeValue: '',
  },
  name: 'Untitled Rule',
  type: '',
  dbrps: [
    {
      db: '',
      rp: '',
    },
  ],
  status: '',
  executing: false,
  error: '',
}
