import {DataTableObject} from 'src/types/tableType'

/** One bucketed sample of an optical metric. */
export interface OpticsPoint {
  time: number
  value: number | null
}

/** One transceiver port, keyed by device + interface + lane. */
export interface OpticsPortRow extends DataTableObject {
  id: string
  devID: string
  ifName: string
  /** Operator-set interface description; empty when the device reports none. */
  alias: string
  lane: string
  tx: number | null
  rx: number | null
  temp: number | null
  status: string
  checkedAt: string
}

/** One device row; each metric carries the worst port's series and its name. */
export interface OpticsDeviceRow extends DataTableObject {
  id: string
  sysName: string
  model: string
  ip: string
  location: string
  tx: OpticsPoint[]
  txPort: string
  rx: OpticsPoint[]
  rxPort: string
  temp: OpticsPoint[]
  tempPort: string
  status: string
  isHealthy: boolean
  checkedAt: string
  ports: OpticsPortRow[]
}
