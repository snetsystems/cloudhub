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

  const data: {sessions: OpenClawSessionDTO[]} = await res.json()
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

  return await res.json()
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

  const data: {messages: OpenClawMessageDTO[]} = await res.json()
  return data.messages || []
}
