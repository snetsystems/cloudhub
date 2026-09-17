export interface Alert {
  name: string
  time: string
  value: string
  host: string
  level: string
  triggerType?: string
  /** Set by hand-maintained SNMP tickscripts. Network device alerts have no
   *  host-details page to link to, so the source cell renders as plain text. */
  alertDomain?: string
}
