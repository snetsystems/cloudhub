export interface DeviceMeta {
  id: string
  ip: string
  hostname: string
  aliasName: string
  deviceType: string
  orgId: string
  isDeletable: boolean
}

export interface DeviceMapping {
  [key: string]: DeviceMeta[]
}
