/**
 * OpenClaw REST API Client for CloudHub AI Chat
 *
 * This module talks to the OpenClaw endpoints with fetch instead of
 * src/utils/ajax, because chat shares this base URL with the events
 * WebSocket and axios cannot carry that. AJAX would normally prefix the
 * configured basepath, so — like the kapacitor log stream in
 * src/kapacitor/apis — this module has to prefix it itself. Route everything,
 * including the WebSocket URL, through openClawUrl() to keep that in one place.
 */

const OPENCLAW_BASE_PATH = '/cloudhub/v2/openclaw'

/**
 * Build an OpenClaw URL under the basepath the server was mounted with.
 * Read window.basepath per call rather than at module scope: index.tsx assigns
 * it while bootstrapping, which can happen after this module is evaluated.
 */
export const openClawUrl = (path = ''): string =>
  `${window.basepath || ''}${OPENCLAW_BASE_PATH}${path}`

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
  public readonly statusText: string

  constructor(message: string, status: number, statusText = '') {
    super(message)
    this.name = 'OpenClawAPIError'
    this.status = status
    this.statusText = statusText
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

// The backend derives the organization and the user from the authenticated
// request context (see openClawOwnerContext in backend/server/openclaw_chat.go)
// and ignores any caller-supplied identity, so none is sent here.
const DEFAULT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
}

// Single entry point for every OpenClaw request, so the basepath and the
// credentials that AJAX would otherwise supply are applied in exactly one
// place. Callers keep their own response and error handling.
const openClawFetch = (
  path: string,
  init: RequestInit = {}
): Promise<Response> =>
  fetch(openClawUrl(path), {
    credentials: 'include',
    ...init,
    headers: {...DEFAULT_HEADERS, ...(init.headers || {})},
  })

/**
 * Delete an OpenClaw chat session by ID.
 * Matches backend route: DELETE /cloudhub/v2/openclaw/sessions/:id
 */
export const deleteOpenClawSession = async (
  sessionId: string
): Promise<void> => {
  const res = await openClawFetch(
    `/sessions/${encodeURIComponent(sessionId)}`,
    {method: 'DELETE'}
  )

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
  const res = await openClawFetch('/sessions')

  if (!res.ok) {
    throw new OpenClawAPIError(
      `Failed to fetch sessions (${res.status}): ${res.statusText}`,
      res.status,
      res.statusText
    )
  }

  const data: {sessions: OpenClawSessionDTO[]} = await res
    .json()
    .catch(() => ({sessions: []}))
  return data.sessions || []
}

/**
 * Create a new OpenClaw chat session.
 * Matches backend route: POST /cloudhub/v2/openclaw/sessions
 */
export const createOpenClawSession = async (
  title: string
): Promise<OpenClawSessionDTO> => {
  const res = await openClawFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify({title}),
  })

  if (!res.ok) {
    throw new OpenClawAPIError(
      `Failed to create session (${res.status}): ${res.statusText}`,
      res.status,
      res.statusText
    )
  }

  return await res
    .json()
    .catch(() => ({id: '', title, createdAt: '', updatedAt: ''}))
}

/**
 * Fetch messages for a specific session.
 * Matches backend route: GET /cloudhub/v2/openclaw/sessions/:id/messages
 */
export const getOpenClawMessages = async (
  sessionId: string,
  signal?: AbortSignal
): Promise<OpenClawMessageDTO[]> => {
  const res = await openClawFetch(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
    {signal}
  )

  if (!res.ok) {
    throw new OpenClawAPIError(
      `Failed to fetch messages (${res.status}): ${res.statusText}`,
      res.status,
      res.statusText
    )
  }

  const data: {messages: OpenClawMessageDTO[]} = await res
    .json()
    .catch(() => ({messages: []}))
  return data.messages || []
}

/**
 * Post a user message to a session. The reply streams back over the events
 * WebSocket, so a resolved promise only means the run was accepted.
 * Matches backend route: POST /cloudhub/v2/openclaw/sessions/:id/messages
 */
export const sendOpenClawMessage = async (
  sessionId: string,
  message: string,
  idempotencyKey: string
): Promise<void> => {
  const res = await openClawFetch(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({message, idempotencyKey}),
    }
  )

  if (!res.ok) {
    throw new OpenClawAPIError(
      `Failed to send message (${res.status}): ${res.statusText}`,
      res.status,
      res.statusText
    )
  }
}

export const getOpenClawApprovals = async (
  sessionId: string,
  signal?: AbortSignal
): Promise<OpenClawApprovalSnapshotDTO> => {
  const res = await openClawFetch(
    `/sessions/${encodeURIComponent(sessionId)}/approvals`,
    {signal}
  )
  if (!res.ok)
    throw new Error(
      `Failed to fetch approvals (${res.status}): ${res.statusText}`
    )
  const data: OpenClawApprovalSnapshotDTO = await res
    .json()
    .catch(() => ({approvals: [], completeSources: []}))
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
  const res = await openClawFetch(
    `/sessions/${encodeURIComponent(sessionId)}/approvals/${encodeURIComponent(
      approvalId
    )}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify({decision}),
    }
  )
  if (!res.ok)
    throw new OpenClawAPIError(
      `Failed to resolve approval (${res.status}): ${res.statusText}`,
      res.status
    )
}
