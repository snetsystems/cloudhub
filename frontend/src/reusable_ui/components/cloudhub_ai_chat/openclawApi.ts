/**
 * OpenClaw REST API Client for CloudHub AI Chat
 */

export const OPENCLAW_BASE_URL = '/cloudhub/v2/openclaw'

export interface OpenClawSessionDTO {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface OpenClawContentPart {
  type: string
  text: string
}

export interface OpenClawMessageDTO {
  role: string
  content: OpenClawContentPart[]
  timestamp: number
}

export type OpenClawApprovalDecision = 'allow-once' | 'deny'
export type OpenClawApprovalSource = 'managed' | 'native'

export class OpenClawAPIError extends Error {
  public readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'OpenClawAPIError'
    this.status = status
    Object.setPrototypeOf(this, OpenClawAPIError.prototype)
  }
}

export interface OpenClawApprovalDTO {
  id: string
  source: OpenClawApprovalSource
  title: string
  description: string
  severity: string
  toolName: string
  allowedDecisions: OpenClawApprovalDecision[]
  createdAt: number
  expiresAt: number
}

export interface OpenClawApprovalSnapshotDTO {
  approvals: OpenClawApprovalDTO[]
  completeSources: OpenClawApprovalSource[]
}

export interface OpenClawResolvedApprovalDTO {
  id: string
  source: OpenClawApprovalSource
  title?: string
  description?: string
  severity?: string
  toolName?: string
  allowedDecisions?: OpenClawApprovalDecision[]
  createdAt?: number
  expiresAt?: number
  decision: OpenClawApprovalDecision
  resolvedAt: number
  resolvedBy?: string
}

export type OpenClawApprovalEventDTO =
  | {
      type: 'approval.requested'
      sessionId: string
      approval: OpenClawApprovalDTO
    }
  | {
      type: 'approval.resolved'
      sessionId: string
      approval: OpenClawResolvedApprovalDTO
    }

const DEFAULT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'X-Organization-Id': 'org-default',
  'X-User-Id': 'user-admin',
}

/**
 * Delete an OpenClaw chat session by ID.
 * Matches backend route: DELETE /cloudhub/v2/openclaw/sessions/:id
 */
export const deleteOpenClawSession = async (sessionId: string): Promise<void> => {
  const res = await fetch(`${OPENCLAW_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: DEFAULT_HEADERS,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    const errorMessage = errorBody?.message || res.statusText || 'Unknown error'
    throw new Error(`Failed to delete session (${res.status}): ${errorMessage}`)
  }
}

/**
 * Fetch all OpenClaw chat sessions.
 * Matches backend route: GET /cloudhub/v2/openclaw/sessions
 */
export const getOpenClawSessions = async (): Promise<OpenClawSessionDTO[]> => {
  const res = await fetch(`${OPENCLAW_BASE_URL}/sessions`, {
    headers: DEFAULT_HEADERS,
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch sessions (${res.status}): ${res.statusText}`)
  }

  const data: {sessions: OpenClawSessionDTO[]} = await res.json().catch(() => ({sessions: []}))
  return data.sessions || []
}

/**
 * Create a new OpenClaw chat session.
 * Matches backend route: POST /cloudhub/v2/openclaw/sessions
 */
export const createOpenClawSession = async (title: string): Promise<OpenClawSessionDTO> => {
  const res = await fetch(`${OPENCLAW_BASE_URL}/sessions`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({title}),
  })

  if (!res.ok) {
    throw new Error(`Failed to create session (${res.status}): ${res.statusText}`)
  }

  return await res.json().catch(() => ({id: '', title, createdAt: '', updatedAt: ''}))
}

/**
 * Fetch messages for a specific session.
 * Matches backend route: GET /cloudhub/v2/openclaw/sessions/:id/messages
 */
export const getOpenClawMessages = async (sessionId: string): Promise<OpenClawMessageDTO[]> => {
  const res = await fetch(`${OPENCLAW_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/messages`, {
    headers: DEFAULT_HEADERS,
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch messages (${res.status}): ${res.statusText}`)
  }

  const data: {messages: OpenClawMessageDTO[]} = await res.json().catch(() => ({messages: []}))
  return data.messages || []
}

export const getOpenClawApprovals = async (
  sessionId: string,
  signal?: AbortSignal
): Promise<OpenClawApprovalSnapshotDTO> => {
  const res = await fetch(
    `${OPENCLAW_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/approvals`,
    {
      headers: DEFAULT_HEADERS,
      signal,
    }
  )
  if (!res.ok)
    throw new Error(
      `Failed to fetch approvals (${res.status}): ${res.statusText}`
    )
  const data: OpenClawApprovalSnapshotDTO = await res.json().catch(() => ({approvals: [], completeSources: []}))
  return {
    approvals: data.approvals || [],
    completeSources: data.completeSources || [],
  }
}

export const resolveOpenClawApproval = async (
  sessionId: string,
  approvalId: string,
  decision: OpenClawApprovalDecision
): Promise<void> => {
  const res = await fetch(
    `${OPENCLAW_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/approvals/${encodeURIComponent(approvalId)}/resolve`,
    {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({decision}),
    }
  )
  if (!res.ok)
    throw new OpenClawAPIError(
      `Failed to resolve approval (${res.status}): ${res.statusText}`,
      res.status
    )
}
