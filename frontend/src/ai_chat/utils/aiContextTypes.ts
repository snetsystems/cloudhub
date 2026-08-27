import {registerAiContextType} from 'src/ai_chat/utils/aiContextRegistry'

/**
 * Context types CloudHub screens can attach.
 *
 * Imported once for its side effects (see src/ai_chat/containers/
 * CloudhubAiChatStandalone). Adding a screen means adding a registration
 * here — nothing inside AI Chat changes.
 */

export interface ServerContextPayload {
  name: string
  /** From the salt minion record, so absent for hosts without one. */
  ip?: string
  /** Alert level from the server list, e.g. 'danger'. Chip display only. */
  status?: string
  cpu?: number
  memory?: number
  disk?: number
  diskIo?: number
}

/**
 * Only identity reaches the agent — never the measurements.
 *
 * The agent queries InfluxDB itself, at full fidelity and over whatever range
 * the question needs. What the table shows is a rounded instant, captured when
 * the row was attached and then frozen while the page keeps auto-refreshing,
 * so sending it would hand the agent a staler, coarser version of something it
 * can read properly — and leave it with no way to tell which number to trust.
 *
 * The measurements stay on the chip, where they tell the user what they picked.
 *
 * The IP is left out too. CloudHub only learns it from a salt minion record, so
 * it is present for some hosts and missing for others — and a missing one reads
 * as "this host has no address" rather than "CloudHub has no record of one".
 * An agent that has to reason about which of those it is has been made worse
 * off, not better, so only the host name is sent.
 */
registerAiContextType<ServerContextPayload>('server', {
  label: '서버',
  toPromptText: host => host.name,
  defaultPrompt: host =>
    `${host.name} 서버의 현재 상태를 진단하고, 이상 징후가 있다면 원인과 조치 방법을 알려줘.`,
})

/** Free text a user selected on a page, quoted into the conversation. */
export interface TextContextPayload {
  text: string
}

registerAiContextType<TextContextPayload>('text', {
  label: '선택한 내용',
  toPromptText: ({text}) => text,
})
