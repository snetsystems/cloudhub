import {MLFunctionMsg} from 'src/device_management/constants'
import {AlertRule} from 'src/types/kapacitor'

export type OrganizationID = string
export type OrganizationName = string

export interface DeviceData {
  id?: string
  organization: OrganizationID
  device_ip: string
  hostname?: string
  device_type?: string
  device_category?: string
  device_os?: string
  is_collecting_cfg_written?: boolean
  ssh_config?: SSHConfig
  snmp_config: SNMPConfig
  sensitivity?: string
  device_vendor?: string
  learning_state?: string
  learning_update_datetime?: string
  learning_finish_datetime?: string
  is_learning?: boolean
  ml_function?: string
  links?: {
    self: string
  }
}

export interface DeviceDataMonitoringStatus extends DeviceData {
  isMonitoring: boolean
}

export interface MonitoringModalProps {
  isCreateLearning?: boolean
  organization: OrganizationName
  device_ip: string
  hostname: string
}

type snmpVersion = '1' | '2c' | '3'
type SecurityLevel =
  | 'noAuthNoPriv'
  | 'authNoPriv'
  | 'authPriv'
  | 'noauthnopriv'
  | 'authnopriv'
  | 'authpriv'
  | ''

export type AuthProtocol =
  | 'md5'
  | 'sha'
  | 'sha2'
  | 'hmac128sha224'
  | 'hmac192sha256'
  | 'hmac256sha384'
  | 'hmac384sha512'
  | ''
export type PrivProtocol = 'des' | 'aes' | 'aes128' | 'aes192' | 'aes256' | ''

export interface SNMPConfig {
  community: string
  port: number
  version: snmpVersion
  protocol: string
  security_level?: SecurityLevel
  security_name?: string
  auth_protocol?: AuthProtocol
  auth_pass?: string
  priv_protocol?: PrivProtocol
  priv_pass?: string
  snmp_port?: number
}

export interface SSHConfig {
  user_id?: string
  password?: string
  en_password?: string
  port?: number
  ssh_port?: number
}

export interface SNMPConnectionRequest {
  device_ip: string
  community?: string
  port?: number
  version?: snmpVersion | string
  protocol?: string
  security_level?: SecurityLevel
  security_name?: string
  auth_protocol?: AuthProtocol
  auth_pass?: string
  priv_protocol?: PrivProtocol
  priv_pass?: string
}

export interface SNMPConnectionResponse {
  data: {
    failed_requests: SNMPConnectionFailedDevice[]
    results: SNMPConnectionSuccessDevice[] | null
  }
}

export interface SNMPConnectionFailedDevice {
  index: number
  device_ip: string
  errorMessage: string
}

export interface SNMPConnectionSuccessDevice {
  device_ip: string
  index: number
  device_type: string
  hostname: string
  device_os: string
}

export type CreateDeviceListRequest = DeviceData[]

export interface CreateDeviceListResponse {
  data: {failed_devices: FailedDevice[] | null}
}

export interface FailedDevice {
  id: string
  device_ip?: string
  device_id?: string
  errorMessage: string
}
export interface GetDeviceListResponse {
  devices?: DeviceData[] | null
}

export interface UpdateDeviceRequest {
  id: string
  deviceData: DeviceData
}

export interface UpdateDeviceResponse {
  data: {failed_devices: FailedDevice[] | null}
}

export interface DeleteDeviceResponse {
  devices: DeviceData[]
  failed_devices: FailedDevice[] | null
}

export interface DeleteDeviceParams {
  devices_ids: string[]
}

export type ImportDevicePageStatus = 'UploadCSV' | 'DeviceStatus'

export type DeviceConnectionStatus = 'None' | 'Creating' | 'Updating'

export interface DeviceMonitoringStatus {
  [x: string]: boolean
}

export interface ApplyMonitoringRequest {
  collecting_devices: CollectingDevice[]
}

export interface ApplyLearningEnableStatusRequest {
  learning_devices: LearningDevice[]
}

export interface LearningDevice {
  device_id: string
  is_learning: boolean
}

export interface CollectingDevice {
  device_id: string
  is_collecting: boolean
  is_collecting_cfg_written: boolean
}

export interface ApplyMonitoringResponse {
  data: {failed_devices: FailedDevice[] | null}
}

export interface CreateDeviceOrganizationOption {
  orgLearningModel: LearningOption
}

export interface UpdateDeviceOrganizationOption {
  id: string
  orgLearningModel: LearningOrganizationOption
}

export interface KapacitorForNetworkDeviceOrganization {
  srcId: string
  kapaId: string
  url: string
  username?: string
  password?: string
  insecure_skip_verify?: boolean
}

export interface LearningOrganizationOption {
  data_duration: number
  ml_function: typeof MLFunctionMsg[keyof typeof MLFunctionMsg]
  learning_cron?: string
  ai_kapacitor?: KapacitorForNetworkDeviceOrganization
  task_status?: 1 | 2
  process_count?: number
}

export interface LearningOption extends LearningOrganizationOption {
  organization: OrganizationID
}

export interface GetAllDevicesOrgResponse {
  organizations: DevicesOrgData[]
}

export interface UpdateDevicesOrgResponse {
  data: DevicesOrgData
}

export interface DevicesOrgData {
  organization: OrganizationID
  data_duration: number
  ml_function: typeof MLFunctionMsg[keyof typeof MLFunctionMsg]
  prediction_mode: typeof PREDICT_MODE[keyof typeof PREDICT_MODE]
  learned_devices_ids: string[]
  collector_server: string
  load_module: string
  is_prediction_active: false
  learning_cron: string
  process_count: number
  ai_kapacitor?: KapacitorForNetworkDeviceOrganization
  collected_devices_ids?: string[]
}

export interface DeviceOrganizationStatus {
  [key: OrganizationID]: boolean
}

const PREDICT_MODE = {
  ML: 'ML',
  DL: 'DL',
  EnsembleOrCondition: 'Ensemble (ML or DL)',
  EnsembleAndCondition: 'Ensemble (ML and DL)',
} as const

export type PredictModeKey = keyof typeof PREDICT_MODE
export type PredictMode = typeof PREDICT_MODE[keyof typeof PREDICT_MODE]

export interface PredictionLayoutCell {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export interface PredictionTooltipNode {
  name: string
  cpu: number
  memory: number
  traffic: string
}

export interface CreateDeviceManagmenntScriptRequest extends AlertRule {
  organization: OrganizationID
  organization_name: string
  predict_mode: string
  task_template?: string
}

export interface CreateDeviceManagmenntScriptResponse extends AlertRule {
  data: {
    links?: {
      self?: string
      kapacitor?: string
      output?: string
    }
  }
}

export interface UpdateDeviceManagmenntScriptRequest extends AlertRule {
  organization: OrganizationID
  organization_name: OrganizationName
  predict_mode: string
  task_template?: string
}

export interface UpdateDeviceManagmenntScriptResponse extends AlertRule {
  data: {
    links?: {
      self?: string
      kapacitor?: string
      output?: string
    }
  }
}

export const authProtocolTextToValue: Record<string, AuthProtocol> = {
  MD5: 'md5',
  SHA: 'sha',
  'SHA-2': 'sha2',
  'HMAC-SHA-224': 'hmac128sha224',
  'HMAC-SHA-256': 'hmac192sha256',
  'HMAC-SHA-384': 'hmac256sha384',
  'HMAC-SHA-512': 'hmac384sha512',
} as const

export const privProtocolTextToValue: Record<string, PrivProtocol> = {
  DES: 'des',
  AES: 'aes',
  'AES-128': 'aes128',
  'AES-192': 'aes192',
  'AES-256': 'aes256',
} as const

export const authProtocolValueToText: Record<AuthProtocol, string> = {
  md5: 'MD5',
  sha: 'SHA',
  sha2: 'SHA-2',
  hmac128sha224: 'HMAC-SHA-224',
  hmac192sha256: 'HMAC-SHA-256',
  hmac256sha384: 'HMAC-SHA-384',
  hmac384sha512: 'HMAC-SHA-512',
  '': '',
} as const

export const privProtocolValueToText: Record<PrivProtocol, string> = {
  des: 'DES',
  aes: 'AES',
  aes128: 'AES-128',
  aes192: 'AES-192',
  aes256: 'AES-256',
  '': '',
} as const

export const SecurityLevelMapping: {[key in SecurityLevel]: SecurityLevel} = {
  noAuthNoPriv: 'noAuthNoPriv',
  authNoPriv: 'authNoPriv',
  authPriv: 'authPriv',
  noauthnopriv: 'noAuthNoPriv',
  authnopriv: 'authNoPriv',
  authpriv: 'authPriv',
  '': '',
} as const
