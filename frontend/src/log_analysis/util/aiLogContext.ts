// Types
import {SyslogTableRows} from 'src/types/logAnalysis'

/**
 * The fields of one syslog row that the report is built from.
 *
 * message_tokens and event.original are deliberately absent: they are the same
 * line split up and the same line with its envelope, so they would repeat the
 * message without adding a fact. See buildLogContextPayload.
 */
export interface LogContextPayload {
  timestamp?: string
  /** Syslog level name, e.g. 'err'. Kept with its code: the name is what an
   * operator reads, the code is what a query filters on. */
  severity?: string
  severityCode?: number
  facility?: string
  facilityCode?: number
  serviceType?: string
  deviceType?: string
  hostname?: string
  hostIp?: string
  processName?: string
  processPid?: number
  message?: string
}

/**
 * Turn one syslog row into the capsule AI Chat attaches.
 *
 * Every field arrives from OpenSearch as an array, so each one goes through
 * the same reader and an absent field is left undefined rather than sent as an
 * empty string the agent would have to interpret.
 */

const UNKNOWN = '미상'

/** Joins what the row actually carries, or '' when it carries none of it. */
const joined = (parts: (string | undefined)[], separator: string): string =>
  parts.filter(Boolean).join(separator)

/** `value` with `detail` in brackets, when there is any detail to add. */
const withDetail = (value: string, detail: string): string =>
  detail ? `${value} (${detail})` : value

/**
 * The message the chat sends for one log row.
 *
 * The row is written into the question rather than attached as context: the
 * report asks for named sections, and the agent has to be able to tell which
 * value is the host and which is the message in order to fill them in.
 *
 * A field the source never set is named as 미상 rather than left blank, so a
 * gap reads as "this row does not say" instead of as a formatting fault the
 * agent should work around.
 */
export const buildLogAnalysisPrompt = (payload: LogContextPayload): string => {
  const host = withDetail(
    payload.hostname || payload.hostIp || UNKNOWN,
    joined(
      // The address is bracketed detail only when the name is something else;
      // a row identified by its IP alone has already used it as the name.
      [payload.hostname ? payload.hostIp : undefined, payload.deviceType],
      ', '
    )
  )

  const process = payload.processName
    ? withDetail(
        payload.processName,
        payload.processPid === undefined ? '' : `PID ${payload.processPid}`
      )
    : undefined

  const service =
    joined(
      [
        process,
        payload.serviceType,
        payload.facility ? `facility ${payload.facility}` : undefined,
      ],
      ' / '
    ) || UNKNOWN

  const severity = payload.severity
    ? withDetail(
        payload.severity,
        payload.severityCode === undefined ? '' : String(payload.severityCode)
      )
    : payload.severityCode === undefined
    ? UNKNOWN
    : String(payload.severityCode)

  return [
    '[요청] 아래 서버 로그의 발생 원인, 위험도 판정, 및 운영자 조치 가이드를 정밀 분석해줘.',
    '■ 1. 로그 헤더 정보',
    `- 발생 시각: ${payload.timestamp || UNKNOWN}`,
    `- 대상 서버: ${host}`,
    `- 프로세스/서비스: ${service}`,
    `- 심각도(Severity): ${severity}`,
    '■ 2. 로그 원문 (Log Message)',
    payload.message || UNKNOWN,
    '■ 3. 분석 요청 항목',
    '1. [이벤트 요약]: 해당 로그 메시지가 의미하는 핵심 개요 (1~2줄)',
    '2. [위험도 평가]: [정상(INFO) / 주의(WARN) / 긴급(CRITICAL)] 판정 및 판단 근거',
    '3. [예상 원인]: 자원 고갈, 네트워크 연결/단절, 가상화/도커 이벤트를 포함한 근본 원인 추정',
    '4. [운영자 조치 가이드]: 수동 조치 필요 여부 및 조치 명령어/확인 사항 (필요 없을 경우 "조치 불필요" 명시)',
    '---',
    '이 로그 텍스트 단건만 보고 단정짓지 말고, 필요 시 관련 데이터를 뒤져서 발생 원인과 조치 필요 여부를 분석해줘.',
  ].join('\n')
}

/**
 * Severity and facility names as the table renders them.
 *
 * Resolved by the caller rather than looked up here, so the agent is told what
 * the user is looking at. Both come from configuration the table already
 * reads, and a second lookup in this module would be free to drift from it.
 */
export interface LogContextLabels {
  severity?: string
  facility?: string
}

const readText = (value: unknown): string | undefined => {
  const first = Array.isArray(value) ? value[0] : value
  if (first === null || first === undefined) {
    return undefined
  }
  const text = String(first).trim()
  return text === '' ? undefined : text
}

const readNumber = (value: unknown): number | undefined => {
  const first = Array.isArray(value) ? value[0] : value
  const parsed = Number(first)
  return first === null || first === undefined || first === '' || isNaN(parsed)
    ? undefined
    : parsed
}

export const buildLogContextPayload = (
  row: SyslogTableRows,
  labels: LogContextLabels = {}
): LogContextPayload => {
  const hostname = readText(row['host.hostname'])
  const hostIp = readText(row['host.ip'])

  return {
    timestamp: readText(row['@timestamp']),
    severity: labels.severity,
    severityCode: readNumber(row['log.syslog.severity.code']),
    facility: labels.facility,
    facilityCode: readNumber(row['log.syslog.facility.code']),
    serviceType: readText(row['service.type']),
    deviceType: readText(row['deviceType']),
    hostname,
    // Some sources log the address as the host name. Sending it twice would
    // read as two facts about the row rather than one.
    hostIp: hostIp === hostname ? undefined : hostIp,
    processName: readText(row['process.name']),
    processPid: readNumber(row['process.pid']),
    // message_tokens is the message split up and event.original is the message
    // with its syslog envelope, so sending them alongside it would repeat the
    // same line three times. event.original stands in only when the parsed
    // message is missing.
    message: readText(row['message']) || readText(row['event.original']),
  }
}
