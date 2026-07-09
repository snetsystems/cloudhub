import * as XLSX from 'xlsx'
import type {URLMonitoringTarget} from 'src/url_monitoring/types'
import type {URLMonitoringTargetUpsertRequest} from 'src/url_monitoring/apis'

const SHEET_NAME = 'Targets'

type ExcelTargetField =
  | 'name'
  | 'url'
  | 'interval'
  | 'responseTimeout'
  | 'method'
  | 'alertRuleIds'

/** Normalized header → request field (matches POST/PATCH / bulk API JSON keys). */
const HEADER_TO_FIELD: Record<string, ExcelTargetField> = {
  name: 'name',
  url: 'url',
  interval: 'interval',
  responsetimeout: 'responseTimeout',
  method: 'method',
  alertruleids: 'alertRuleIds',
}

function normalizeHeaderCell(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return String(value).trim()
}

export function downloadUrlMonitoringTargetsExcel(
  targets: URLMonitoringTarget[],
  filename = 'url-monitoring-targets.xlsx'
): void {
  const rows = targets.map(t => ({
    name: t.name ?? '',
    url: t.url ?? '',
    interval: t.interval ?? '',
    responseTimeout: t.responseTimeout ?? '',
    method: t.method ?? '',
    alertRuleIds: (t.alertRuleIds ?? []).join(','),
  }))
  const ws = XLSX.utils.json_to_sheet(
    rows.length
      ? rows
      : [
          {
            name: '',
            url: '',
            interval: '',
            responseTimeout: '',
            method: '',
            alertRuleIds: '',
          },
        ]
  )
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME)
  XLSX.writeFile(wb, filename)
}

export interface ParseUrlMonitoringExcelResult {
  targets: URLMonitoringTargetUpsertRequest[]
  skippedEmptyRows: number
}

/**
 * Reads the first worksheet; first row must be headers.
 * Accepts header labels like "Name", "URL", "response_timeout", etc.
 */
export function parseUrlMonitoringExcelBuffer(
  buffer: ArrayBuffer
): ParseUrlMonitoringExcelResult {
  const wb = XLSX.read(buffer, {type: 'array'})
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return {targets: [], skippedEmptyRows: 0}
  }
  const sheet = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  if (!matrix.length) {
    return {targets: [], skippedEmptyRows: 0}
  }

  const headerRow = matrix[0] ?? []
  const fieldByCol: Array<ExcelTargetField | null> = []
  for (let c = 0; c < headerRow.length; c++) {
    const key = normalizeHeaderCell(headerRow[c])
    fieldByCol[c] = HEADER_TO_FIELD[key] ?? null
  }

  if (!fieldByCol.some(Boolean)) {
    return {targets: [], skippedEmptyRows: 0}
  }

  const targets: URLMonitoringTargetUpsertRequest[] = []
  let skippedEmptyRows = 0

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    const rec: URLMonitoringTargetUpsertRequest = {
      name: '',
      url: '',
      interval: '',
    }
    for (let c = 0; c < fieldByCol.length; c++) {
      const field = fieldByCol[c]
      if (!field) continue
      const raw = row[c]
      const str = cellToString(raw)
      switch (field) {
        case 'name':
        case 'url':
        case 'interval':
        case 'responseTimeout':
        case 'method':
          rec[field] = str
          break
        case 'alertRuleIds':
          rec[field] = str
            .split(/[,;]/)
            .map(id => id.trim())
            .filter(Boolean)
          break
        default: {
          const _n: never = field
          void _n
        }
      }
    }
    const name = rec.name.trim()
    const url = rec.url.trim()
    if (!name && !url) {
      skippedEmptyRows += 1
      continue
    }
    targets.push(rec)
  }

  return {targets, skippedEmptyRows}
}
