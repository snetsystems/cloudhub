import {MLFunctionMsg} from 'src/device_management/constants'

export interface DeviceData {
  id?: number
  organization: string
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
  learning_update_date?: string
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
  organization: string
  device_ip: string
  hostname: string
}

export interface SNMPConfig {
  community: string
  port: number
  version: string
  protocol: string
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
  version?: string
  protocol?: string
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
  data: {failed_devices: FailedDevice[]}
}

export interface FailedDevice {
  id: number
  device_ip?: string
  device_id?: string
  errorMessage: string
}
export interface GetDeviceListResponse {
  devices?: DeviceData[] | null
}

export interface UpdateDeviceRequest {
  id: number
  deviceData: DeviceData
}

export interface UpdateDeviceResponse {
  data: {failed_devices: FailedDevice[]}
}

export interface DeleteDeviceResponse {
  code: number
  message: string
}

export interface DeleteDeviceParams {
  devices_ids: number[]
}

export type ImportDevicePageStatus = 'UploadCSV' | 'DeviceStatus'

export type DeviceConnectionStatus = 'None' | 'Creating' | 'Updating'

interface deviceMonitoringStatusData {
  uptime?: number
}
export interface DeviceMonitoringStatus {
  [x: string]: deviceMonitoringStatusData
}

export interface ApplyMonitoringRequest {
  collecting_devices: CollectingDevice[]
}

export interface ApplyLearningEnableStatusRequest {
  learning_devices: LearningDevice[]
}

export interface LearningDevice {
  device_id: number
  is_learning: boolean
}

export interface CollectingDevice {
  device_id: number
  is_collecting: boolean
  is_collecting_cfg_written: boolean
}

export interface ApplyMonitoringResponse {
  data: {failed_devices: FailedDevice[]}
}

export interface CreateDeviceOrganizationOption {
  orgLearningModel: LearningOption
}

export interface UpdateDeviceOrganizationOption {
  id: string
  orgLearningModel: LearningOrganizationOption
}

export interface LearningOrganizationOption {
  data_duration: number
  ml_function: typeof MLFunctionMsg[keyof typeof MLFunctionMsg]
  is_prediction_active: boolean
  learn_cycle: number
  prediction_mode: typeof PredictionMode[keyof typeof PredictionMode]
}

export interface LearningOption extends LearningOrganizationOption {
  organization: string
}

export interface GetAllDevicesOrgResponse {
  organizations: DevicesOrgData[]
}

export interface UpdateDevicesOrgResponse {
  data: DevicesOrgData
}

export interface DevicesOrgData {
  organization: string
  data_duration: number
  ml_function: typeof MLFunctionMsg[keyof typeof MLFunctionMsg]
  learn_cycle: number
  prediction_mode: typeof PredictionMode[keyof typeof PredictionMode]
  learned_devices_ids: number[]
  collector_server: string
  load_module: string
  is_prediction_active: false
  collected_devices_ids: number[]
}

export const PredictionMode = {
  ML: 'ML',
  DL: 'DL',
  None: 'None',
  Ensemble: 'ML + DL',
} as const

export interface PredictionLayoutCell {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}
