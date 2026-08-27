import {toLineValues, toNumericPoint} from 'src/dashboards/utils/tableLineChart'
import {ServerContextPayload} from 'src/ai_chat/utils/aiContextTypes'
import {AlertStatusMap} from 'src/hosts/types/alertStatus'
import {Host} from 'src/shared/apis/host'

/**
 * Turn one server list row into the capsule payload AI Chat attaches.
 *
 * Row values arrive as a single number in gauge mode and as a series in line
 * mode, so every field goes through the same reader and anything unreadable is
 * left undefined rather than guessed at.
 */
const readCellNumber = (value: unknown): number | undefined => {
  if (Array.isArray(value)) {
    const points = toLineValues(value as any)
    const latest = points[points.length - 1]
    const parsed = toNumericPoint(latest?.value as any)
    return parsed ?? undefined
  }

  const parsed = toNumericPoint(value as any)
  return parsed ?? undefined
}

/**
 * Skill suggested when a server is attached from the server list.
 *
 * Seeded into the composer as editable text, so a user who wants something
 * other than an inspection can simply delete it.
 */
export const SERVER_ATTACH_SKILL = '/ops-server-health-check'

/** Question sent with the skill when a server row is diagnosed. */
export const SERVER_DIAGNOSE_MESSAGE = '점검해줘'

const percent = (value?: number): string | null =>
  typeof value === 'number' ? `${value.toFixed(0)}%` : null

export const buildServerContextPayload = (
  host: string,
  rowData: Record<string, unknown>,
  hosts: Host[] = [],
  alertStatusMap: AlertStatusMap = {}
): ServerContextPayload => {
  const hostInfo = hosts.find(h => h.minionId === host)

  return {
    name: host,
    ip: hostInfo?.privateIps?.[0],
    status: alertStatusMap[host]?.currentLevel,
    cpu: readCellNumber(rowData['CPU Usage']),
    memory: readCellNumber(rowData['Mem Usage']),
    disk: readCellNumber(rowData['Disk Usage']),
    diskIo: readCellNumber(rowData['Disk I/O %']),
  }
}

/** One line of detail shown on the chip, not sent to the agent. */
export const buildServerContextSummary = (
  rowData: Record<string, unknown>
): string => {
  const parts = [
    percent(readCellNumber(rowData['CPU Usage'])),
    percent(readCellNumber(rowData['Mem Usage'])),
  ]

  const [cpu, memory] = parts

  return [cpu ? `CPU ${cpu}` : null, memory ? `MEM ${memory}` : null]
    .filter(Boolean)
    .join(', ')
}
