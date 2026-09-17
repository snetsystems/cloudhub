export interface Alert {
  name: string
  time: string
  value: string
  host: string
  level: string
  triggerType?: string
  /** Set by the hand-maintained snmp_nx tickscripts. */
  alertDomain?: string
  /** Management ip of the network device. The source cell shows "<port> @ <ip>",
   *  but the host details page looks a device up by agent_host, so the link
   *  needs the bare ip. */
  agentHost?: string
}
