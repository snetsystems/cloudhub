import {OpticsSeverity} from 'src/device_management/constants/opticsThreshold'
import {PortLinkStatus} from 'src/device_management/constants/portLinkStatus'
import {DataTableObject} from 'src/types/tableType'

/** One physical switch port. */
export interface SwitchPortRow extends DataTableObject {
  id: string
  devID: string
  ifName: string
  /** Operator-set interface description; empty when the device reports none. */
  alias: string
  admin: string
  oper: string
  status: PortLinkStatus
  /** Ticks since the last oper change; null when uptime or change is unknown. */
  sinceChangeTicks: number | null
}

/** One switch, with its ports counted by link status. */
export interface SwitchPortDeviceRow extends DataTableObject {
  id: string
  sysName: string
  model: string
  ip: string
  location: string
  up: number
  down: number
  longDown: number
  shutdown: number
  unused: number
  /** upstream + not_present + unknown. */
  other: number
  severity: OpticsSeverity
  checkedAt: string
  ports: SwitchPortRow[]
}
