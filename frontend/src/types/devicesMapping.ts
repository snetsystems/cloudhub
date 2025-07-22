export interface DeviceMeta {
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

export interface DeviceToOrgMapping {
  orgId: string
  aliasName: string
}
