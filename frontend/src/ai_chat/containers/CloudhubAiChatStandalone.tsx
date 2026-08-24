import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  ChangeEvent,
  KeyboardEvent,
  FC,
} from 'react'
import classnames from 'classnames'
import uuid from 'uuid'

// Cloudhub Design System Types & Button Reusable Component
import {
  ComponentColor,
  ComponentSize,
  ButtonShape,
  ComponentStatus,
} from 'src/reusable_ui/types'
import Button from 'src/reusable_ui/components/Button'

// Cloudhub Reusable Components & Threesizer Panels
import CollapsibleSidePanelSlice from 'src/shared/components/CollapsibleSidePanelSlice'

// Cloudhub Reusable Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import PageSpinner from 'src/shared/components/PageSpinner'
import AiChatSidebar from 'src/ai_chat/containers/AiChatSidebar'
import SubagentInspectorPanel, {
  CustomPanelView,
} from 'src/ai_chat/components/SubagentInspectorPanel'
import AiChatMessageMarkdown from 'src/ai_chat/components/AiChatMessageMarkdown'
import AiChatMessageAvatar from 'src/ai_chat/components/AiChatMessageAvatar'
import AiChatBadge from 'src/ai_chat/components/AiChatBadge'
import OpenClawApprovalCard from 'src/ai_chat/components/OpenClawApprovalCard'
import {
  deleteOpenClawSession,
  OpenClawApprovalEventDTO,
} from 'src/ai_chat/apis/openclawApi'
import {useOpenClawApprovals} from 'src/ai_chat/hooks/useOpenClawApprovals'

// Cloudhub Redux Notification Action & Helpers
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {defaultErrorNotification} from 'src/shared/copy/notifications'
import {connect} from 'react-redux'
import moment from 'moment'
import {TimeZones} from 'src/types/app'

// SCSS Theme Styling (Influx / SNet Color Variables)
import './CloudhubAiChatStandalone.scss'

export interface SubagentTask {
  id: string
  role: string
  taskName: string
  status: 'RUNNING' | 'SUCCESS' | 'ERROR' | 'QUEUED'
  progress: number
  latestLog: string
  currentAction?: string
  characterAvatar?: string
  currentStepIndex?: number
  steps?: {title: string; status: 'done' | 'active' | 'pending' | 'error'}[]
  timeline?: {
    title: string
    status: 'done' | 'running' | 'active' | 'pending' | 'error'
  }[]
}

export interface ActivityCardItem {
  id: string
  type: 'mcp' | 'tool'
  label: string
  description?: string
  detail?: string
  error?: string
  status: 'running' | 'success' | 'error' | 'blocked'
  input?: string
  startedAt?: number
  endedAt?: number
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'ai' | 'system'
  text: string
  timestamp: string
  timestampRaw?: number
  action?: 'ALLOW' | 'BLOCKED' | 'REDACTED'
  toolCommand?: string
  stdout?: string
  isStreaming?: boolean
  activities?: ActivityCardItem[]
  isFailed?: boolean
}

export interface ChatSession {
  id: string
  title: string
  updatedAt: string
  createdAt?: string
  messages: ChatMessage[]
  subagents?: SubagentTask[]
}

export interface CloudhubAiChatProps {
  mode?: 'drawer' | 'widget' | 'full'
  isOpen?: boolean
  onClose?: () => void
  customClass?: string
  subagentDefaultView?: 'terminal' | 'character'
  customPanelViews?: CustomPanelView[]
  defaultSidebarCollapsed?: boolean
  chatOnly?: boolean
  timeZone?: TimeZones
}

/* REAL OPENCLAW REST & WEBSOCKET API INTEGRATION */
const OPENCLAW_BASE_URL = '/cloudhub/v2/openclaw'

interface OpenClawSessionDTO {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

interface OpenClawContentPart {
  type: string
  text: string
}

interface OpenClawMessageDTO {
  role: string
  content: OpenClawContentPart[]
  timestamp: number
}

const toChatSession = (dto: OpenClawSessionDTO): ChatSession => ({
  id: dto.id,
  title: dto.title,
  updatedAt: dto.updatedAt,
  createdAt: dto.createdAt,
  messages: [],
})

export const generateDefaultSessionTitle = (
  sessionList: ChatSession[]
): string => {
  let maxNum = sessionList.length
  sessionList.forEach(s => {
    const match = s.title?.match(
      /신규\s*(?:OpenClaw\s*)?대화\s*세션\s*#?(\d+)/i
    )
    if (match) {
      const num = parseInt(match[1], 10)
      if (!isNaN(num) && num > maxNum) {
        maxNum = num
      }
    }
  })
  return `신규 대화 세션 #${maxNum + 1}`
}

const isJsonString = (str: string): boolean => {
  const trimmed = str.trim()
  if (
    (!trimmed.startsWith('{') || !trimmed.endsWith('}')) &&
    (!trimmed.startsWith('[') || !trimmed.endsWith(']'))
  ) {
    return false
  }
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

const isRawToolErrorMessage = (str: string): boolean => {
  const trimmed = str.trim()
  return (
    trimmed.startsWith('Tool ') ||
    trimmed.startsWith('Error: Tool') ||
    trimmed.includes('tool not found') ||
    trimmed.includes('Tool read not found')
  )
}

const extractDisplayableText = (content: any): string => {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(part => {
        if (!part) return false
        if (part.type === 'toolCall') return false
        const text = typeof part === 'string' ? part : part.text || ''
        if (!text) return false
        if (isJsonString(text)) return false
        if (isRawToolErrorMessage(text)) return false
        return true
      })
      .map(part => (typeof part === 'string' ? part : part.text || ''))
      .join('')
  }
  return ''
}

const ensureString = (val: any): string => {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val)
    } catch {
      return String(val)
    }
  }
  return String(val)
}

export const formatChatTimestamp = (
  timestamp?: number | string | Date,
  timeZone: TimeZones = TimeZones.Local
): string => {
  if (!timestamp) {
    const m = timeZone === TimeZones.UTC ? moment.utc() : moment()
    return m.format('HH:mm')
  }

  const rawNum =
    typeof timestamp === 'string' && /^\d+$/.test(timestamp)
      ? Number(timestamp)
      : timestamp

  const m = timeZone === TimeZones.UTC ? moment.utc(rawNum) : moment(rawNum)
  if (!m.isValid()) {
    const fallback = timeZone === TimeZones.UTC ? moment.utc() : moment()
    return fallback.format('HH:mm')
  }

  const now = timeZone === TimeZones.UTC ? moment.utc() : moment()
  const isToday = m.isSame(now, 'day')
  const isThisYear = m.isSame(now, 'year')

  if (isToday) {
    return m.format('HH:mm')
  }
  if (isThisYear) {
    return m.format('M[월] D[일] HH:mm')
  }
  return m.format('YYYY[년] M[월] D[일] HH:mm')
}

const parseOpenClawHistory = (rawMessages: any[]): ChatMessage[] => {
  if (!rawMessages || !Array.isArray(rawMessages) || rawMessages.length === 0)
    return []

  const chatMessages: ChatMessage[] = []
  let currentAiMessage: ChatMessage | null = null
  const pendingActivityMap: Map<string, ActivityCardItem> = new Map()

  const flushAiMessage = () => {
    if (currentAiMessage) {
      if (
        currentAiMessage.text ||
        (currentAiMessage.activities && currentAiMessage.activities.length > 0)
      ) {
        chatMessages.push(currentAiMessage)
      }
      currentAiMessage = null
    }
  }

  rawMessages.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object') return
    if (raw.role === 'system') return

    const role = (raw.role || raw.sender || '').toLowerCase()

    if (role === 'user' || role === 'human' || role === 'client') {
      flushAiMessage()
      let userText = ''
      if (typeof raw.content === 'string') {
        userText = raw.content
      } else if (Array.isArray(raw.content)) {
        userText = raw.content
          .map((p: any) =>
            typeof p === 'string' ? p : p?.text || p?.content || p?.value || ''
          )
          .join('')
      } else if (typeof raw.text === 'string') {
        userText = raw.text
      } else if (raw.content) {
        userText = String(raw.content)
      }

      // Only ignore OpenClaw's internal automated crash recovery prompt
      // Genuine user messages (even if they start with [System] or [OpenClaw]) will never be blocked
      const isInternalCrashRecovery =
        userText.includes('interrupted by a gateway restart') &&
        userText.includes('Continue from the existing transcript')

      if (isInternalCrashRecovery && !raw.idempotencyKey) {
        return
      }

      const rawTs = raw.timestamp ? Number(raw.timestamp) : Date.now()

      chatMessages.push({
        id:
          raw.__openclaw?.id ||
          raw.id ||
          `user-${raw.timestamp || Date.now()}-${idx}`,
        sender: 'user',
        text: userText,
        timestamp: formatChatTimestamp(rawTs),
        timestampRaw: rawTs,
      })
      return
    }

    if (
      role === 'assistant' ||
      role === 'model' ||
      role === 'agent' ||
      role === 'bot' ||
      role === 'ai'
    ) {
      const rawTs = raw.timestamp ? Number(raw.timestamp) : Date.now()
      if (!currentAiMessage) {
        currentAiMessage = {
          id:
            raw.__openclaw?.id ||
            raw.id ||
            `ai-${raw.timestamp || Date.now()}-${idx}`,
          sender: 'ai',
          text: '',
          timestamp: formatChatTimestamp(rawTs),
          timestampRaw: rawTs,
          activities: [],
        }
      }

      if (Array.isArray(raw.content)) {
        for (const part of raw.content) {
          if (!part) continue
          if (
            part.type === 'toolCall' ||
            part.type === 'tool_call' ||
            part.type === 'tool'
          ) {
            const toolName = part.name || part.toolName || 'tool'
            const isMcp = toolName.includes('__')
            let inputStr = ''
            try {
              inputStr = part.arguments
                ? JSON.stringify(part.arguments, null, 2)
                : ''
            } catch {
              inputStr = String(part.arguments || '')
            }
            const rawDesc =
              part.arguments?.command ||
              part.arguments?.query ||
              part.arguments?.path ||
              part.arguments?.url ||
              inputStr
            const desc = ensureString(rawDesc)

            const card: ActivityCardItem = {
              id: part.id || part.toolCallId || `act-${idx}`,
              type: isMcp ? 'mcp' : 'tool',
              label: toolName,
              description: desc,
              input: inputStr,
              status: 'success',
              startedAt: raw.timestamp ? Number(raw.timestamp) : undefined,
            }
            if (!currentAiMessage.activities) {
              currentAiMessage.activities = []
            }
            currentAiMessage.activities.push(card)
            if (part.id) {
              pendingActivityMap.set(part.id, card)
            }
          } else if (
            (part.type === 'text' || !part.type) &&
            (part.text || part.content || typeof part === 'string')
          ) {
            const addedText =
              typeof part === 'string' ? part : part.text || part.content || ''
            currentAiMessage.text =
              (currentAiMessage.text ? currentAiMessage.text + '\n' : '') +
              addedText
          }
        }
      } else if (typeof raw.content === 'string' && raw.content) {
        currentAiMessage.text =
          (currentAiMessage.text ? currentAiMessage.text + '\n' : '') +
          raw.content
      } else if (typeof raw.text === 'string' && raw.text) {
        currentAiMessage.text =
          (currentAiMessage.text ? currentAiMessage.text + '\n' : '') + raw.text
      }
      return
    }

    if (role === 'toolresult' || role === 'tool_result' || role === 'tool') {
      let resultText = ''
      if (Array.isArray(raw.content)) {
        resultText = raw.content
          .map((p: any) =>
            typeof p === 'string' ? p : p?.text || p?.content || p?.output || ''
          )
          .join('')
      } else if (typeof raw.content === 'string') {
        resultText = raw.content
      } else if (typeof raw.output === 'string') {
        resultText = raw.output
      } else if (raw.content) {
        resultText = String(raw.content)
      }

      const toolCallId = raw.toolCallId || raw.tool_call_id || raw.id
      const targetCard = toolCallId ? pendingActivityMap.get(toolCallId) : null

      if (targetCard) {
        targetCard.status = raw.isError ? 'error' : 'success'
        targetCard.endedAt = raw.timestamp ? Number(raw.timestamp) : undefined
        if (raw.isError) {
          targetCard.error = resultText
        } else {
          targetCard.detail = resultText
        }
      } else {
        const rawTs = raw.timestamp ? Number(raw.timestamp) : Date.now()
        if (!currentAiMessage) {
          currentAiMessage = {
            id:
              raw.__openclaw?.id ||
              raw.id ||
              `ai-${raw.timestamp || Date.now()}-${idx}`,
            sender: 'ai',
            text: '',
            timestamp: formatChatTimestamp(rawTs),
            timestampRaw: rawTs,
            activities: [],
          }
        }
        const toolName = raw.toolName || raw.name || 'tool'
        const card: ActivityCardItem = {
          id: toolCallId || raw.__openclaw?.id || `tool-${idx}`,
          type: toolName.includes('__') ? 'mcp' : 'tool',
          label: toolName,
          status: raw.isError ? 'error' : 'success',
          detail: raw.isError ? undefined : resultText,
          error: raw.isError ? resultText : undefined,
          endedAt: raw.timestamp ? Number(raw.timestamp) : undefined,
        }
        if (!currentAiMessage.activities) {
          currentAiMessage.activities = []
        }
        currentAiMessage.activities.push(card)
      }
    }
  })

  flushAiMessage()
  return chatMessages
}

const mergeHistoryWithLocal = (
  existing: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] => {
  if (!existing || existing.length === 0) return incoming || []
  if (!incoming || incoming.length === 0) return existing

  const merged = [...existing]

  incoming.forEach(incMsg => {
    // 1. Match by exact ID
    let foundIdx = merged.findIndex(m => m.id === incMsg.id)

    // 2. If not found by ID, match by sender and text content
    if (foundIdx < 0 && incMsg.text && incMsg.text.trim()) {
      foundIdx = merged.findIndex(
        m =>
          m.sender === incMsg.sender &&
          m.text &&
          m.text.trim() === incMsg.text.trim()
      )
    }

    // 3. If incoming is an AI message from server and we have a local in-progress AI message, match it
    if (foundIdx < 0 && incMsg.sender === 'ai') {
      const streamingIdx = merged.findIndex(
        m => m.sender === 'ai' && (m.isStreaming || m.id.startsWith('m-ai-'))
      )
      if (streamingIdx >= 0) {
        foundIdx = streamingIdx
      }
    }

    if (foundIdx >= 0) {
      const ex = merged[foundIdx]
      // Merge activities to keep all tool executions
      const existingActs = ex.activities || []
      const incomingActs = incMsg.activities || []
      const actMap = new Map<string, ActivityCardItem>()
      existingActs.forEach(a => actMap.set(a.id, a))
      incomingActs.forEach(a =>
        actMap.set(a.id, {...(actMap.get(a.id) || {}), ...a})
      )

      merged[foundIdx] = {
        ...ex,
        ...incMsg,
        text: incMsg.text || ex.text,
        timestamp: incMsg.timestamp || ex.timestamp,
        timestampRaw: incMsg.timestampRaw || ex.timestampRaw,
        activities: Array.from(actMap.values()),
        isStreaming: false,
      }
    } else {
      // New message from server: append
      merged.push(incMsg)
    }
  })

  return merged
}

interface ComponentProps extends CloudhubAiChatProps {
  notify?: (notification: any) => void
  persistedTimeZone?: TimeZones
}

export const CloudhubAiChatStandaloneUnconnected: FC<ComponentProps> = ({
  mode = 'drawer',
  isOpen = true,
  onClose,
  customClass,
  subagentDefaultView = 'character',
  customPanelViews = [],
  defaultSidebarCollapsed = false,
  chatOnly = false,
  timeZone: timeZoneProp,
  persistedTimeZone,
  notify,
}) => {
  const effectiveTimeZone = timeZoneProp ?? persistedTimeZone ?? TimeZones.Local

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [inputPrompt, setInputPrompt] = useState<string>('')
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(false)
  const [showSubagentPanel, setShowSubagentPanel] = useState<boolean>(false)
  const [subagentFilter, setSubagentFilter] = useState<
    'ALL' | 'RUNNING' | 'SUCCESS' | 'ERROR'
  >('ALL')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedInspectorMessageId, setSelectedInspectorMessageId] = useState<
    string | null
  >(null)
  const [activeInspectorTab, setActiveInspectorTab] = useState<string>(
    'activity'
  )
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingRunsRef = useRef<Record<string, string>>({})
  const sessionsRef = useRef<ChatSession[]>(sessions)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [isJustCompleted, setIsJustCompleted] = useState<boolean>(false)
  const prevStreamingRef = useRef<boolean>(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Compute list of turns for the activity inspector
  const currentChatSession = sessions.find(s => s.id === activeSessionId)
  const currentSessionMessages = currentChatSession?.messages || []

  const conversationTurns = useMemo(() => {
    const turns: Array<{
      id: string
      userPrompt?: string
      aiResponse?: string
      timestamp?: string
      activities?: ActivityCardItem[]
      toolCommand?: string
      isStreaming?: boolean
    }> = []
    let lastUserPrompt = ''

    currentSessionMessages.forEach(msg => {
      if (msg.sender === 'user') {
        lastUserPrompt = msg.text
      } else if (msg.sender === 'ai') {
        turns.push({
          id: msg.id,
          userPrompt: lastUserPrompt,
          aiResponse: msg.text,
          timestamp: formatChatTimestamp(
            msg.timestampRaw || msg.timestamp,
            effectiveTimeZone
          ),
          activities: msg.activities || [],
          toolCommand: msg.toolCommand,
          isStreaming: msg.isStreaming,
        })
      }
    })

    return turns
  }, [currentSessionMessages, effectiveTimeZone])

  const targetInspectorMessage = useMemo(() => {
    if (selectedInspectorMessageId) {
      const found = currentSessionMessages.find(
        m => m.id === selectedInspectorMessageId
      )
      if (found) return found
    }
    // Default to the last AI message with activities
    for (let i = currentSessionMessages.length - 1; i >= 0; i--) {
      const m = currentSessionMessages[i]
      if (
        m.sender === 'ai' &&
        ((m.activities && m.activities.length > 0) || m.toolCommand)
      ) {
        return m
      }
    }
    // Or just the last AI message
    for (let i = currentSessionMessages.length - 1; i >= 0; i--) {
      if (currentSessionMessages[i].sender === 'ai')
        return currentSessionMessages[i]
    }
    return null
  }, [currentSessionMessages, selectedInspectorMessageId])

  const handleOpenActivityInspector = useCallback((messageId: string) => {
    setSelectedInspectorMessageId(messageId)
    setActiveInspectorTab('activity')
    setShowSubagentPanel(true)
  }, [])

  const handleCopyMessageText = useCallback((msgId: string, text: string) => {
    if (!text) return
    const fallbackCopy = (content: string) => {
      try {
        const el = document.createElement('textarea')
        el.value = content
        el.setAttribute('readonly', '')
        el.style.position = 'absolute'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      } catch (e) {
        console.warn('[OpenClaw AI Chat]: Copy fallback failed:', e)
      }
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        fallbackCopy(text)
      })
    } else {
      fallbackCopy(text)
    }

    setCopiedMessageId(msgId)
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedMessageId(null)
    }, 2000)
  }, [])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  // Detect when streaming finishes: trigger ready glow & auto-focus textarea
  useEffect(() => {
    if (prevStreamingRef.current && !isStreamingActive) {
      setIsJustCompleted(true)
      const timer = setTimeout(() => {
        setIsJustCompleted(false)
      }, 1200)
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
      return () => clearTimeout(timer)
    }
    prevStreamingRef.current = isStreamingActive
  }, [isStreamingActive])

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 30), 160)
    textarea.style.height = `${newHeight}px`
  }

  useEffect(() => {
    adjustTextareaHeight()
    const frameId = requestAnimationFrame(adjustTextareaHeight)
    const timer = setTimeout(adjustTextareaHeight, 60)
    return () => {
      cancelAnimationFrame(frameId)
      clearTimeout(timer)
    }
  }, [inputPrompt, showSubagentPanel])

  useEffect(() => {
    window.addEventListener('resize', adjustTextareaHeight)
    return () => {
      window.removeEventListener('resize', adjustTextareaHeight)
    }
  }, [])

  useEffect(() => {
    sessionsRef.current = sessions
    const current = sessions.find(s => s.id === activeSessionId)
    const isStreaming = Boolean(current?.messages?.some(m => m.isStreaming))
    setIsStreamingActive(isStreaming)
  }, [sessions, activeSessionId])

  const triggerErrorNotification = useCallback(
    (msg: string) => {
      if (notify) {
        notify({
          ...defaultErrorNotification,
          message: msg,
        })
      } else {
        console.error('[OpenClaw AI Chat Error]:', msg)
      }
    },
    [notify]
  )

  const {
    approvals,
    now,
    refreshApprovals,
    handleApprovalEvent,
    resolveApproval,
  } = useOpenClawApprovals(activeSessionId, triggerErrorNotification)

  // Original clean session fetcher with safe message preservation
  const fetchSessions = async () => {
    try {
      const res = await fetch(`${OPENCLAW_BASE_URL}/sessions`, {
        headers: {
          'X-Organization-Id': 'org-default',
          'X-User-Id': 'user-admin',
        },
      })
      if (!res.ok) {
        setIsLoadingHistory(false)
        return
      }
      const data: {
        sessions: OpenClawSessionDTO[]
      } = await res.json().catch(() => ({sessions: []}))
      const loadedDtos = data.sessions || []

      setSessions(prev => {
        const prevMap = new Map(prev.map(s => [s.id, s]))
        const merged: ChatSession[] = loadedDtos.map(dto => {
          const existing = prevMap.get(dto.id)
          return {
            id: dto.id,
            title: dto.title || existing?.title || '새 대화',
            updatedAt: dto.updatedAt,
            messages: existing?.messages || [],
            subagents: existing?.subagents || [],
          }
        })

        // Preserve any optimistic local sessions not yet in backend
        prev.forEach(p => {
          if (!loadedDtos.some(d => d.id === p.id)) {
            merged.push(p)
          }
        })

        return merged
      })

      setActiveSessionId(currentActive => {
        // If currentActive is already set and exists, KEEP IT!
        if (
          currentActive &&
          (loadedDtos.some(d => d.id === currentActive) ||
            currentActive === 'demo-markdown-session')
        ) {
          return currentActive
        }
        // Only if no active session is selected, pick the first one
        if (!currentActive && loadedDtos.length > 0) {
          return loadedDtos[0].id
        }
        return currentActive
      })
    } catch (err: any) {
      console.warn('[OpenClaw AI Chat]: Failed to fetch sessions:', err)
      setIsLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  // Original clean history fetcher & WebSocket connection
  useEffect(() => {
    if (!activeSessionId) {
      setIsLoadingHistory(false)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      return
    }

    const fetchMessages = async (isBackground = false) => {
      const currentSession = sessionsRef.current.find(
        s => s.id === activeSessionId
      )
      const hasExistingMessages = Boolean(
        currentSession &&
          currentSession.messages &&
          currentSession.messages.length > 0
      )

      if (!isBackground && !hasExistingMessages) {
        setIsLoadingHistory(true)
      }
      try {
        const res = await fetch(
          `${OPENCLAW_BASE_URL}/sessions/${activeSessionId}/messages`,
          {
            headers: {
              'X-Organization-Id': 'org-default',
              'X-User-Id': 'user-admin',
            },
          }
        )
        if (!res.ok) return

        const rawJson: any = await res.json().catch(() => null)
        let rawList: any[] = []
        if (Array.isArray(rawJson)) {
          rawList = rawJson
        } else if (rawJson && Array.isArray(rawJson.messages)) {
          rawList = rawJson.messages
        } else if (rawJson && Array.isArray(rawJson.data)) {
          rawList = rawJson.data
        } else if (rawJson && Array.isArray(rawJson.history)) {
          rawList = rawJson.history
        }
        const msgs = parseOpenClawHistory(rawList)
        setSessions(prev =>
          prev.map(s => {
            if (s.id !== activeSessionId) return s
            return {
              ...s,
              messages: mergeHistoryWithLocal(s.messages || [], msgs),
            }
          })
        )
      } catch (err: any) {
        console.warn(
          '[OpenClaw AI Chat]: Failed to fetch message history:',
          err
        )
      } finally {
        if (!isBackground && !hasExistingMessages) {
          setIsLoadingHistory(false)
        }
      }
    }

    fetchMessages()

    if (wsRef.current) {
      wsRef.current.close()
    }

    let isTornDown = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const mergeActivityCardIntoSession = (actData: any) => {
      if (!actData) return
      const key = ensureString(
        actData.toolCallId || actData.itemId || `act-${Date.now()}`
      )
      const phase = actData.phase || 'start'
      const kind = actData.kind || 'tool'
      const title = ensureString(
        actData.title || actData.meta || actData.name || key
      )
      const isFinished =
        phase === 'end' ||
        phase === 'output' ||
        actData.status === 'completed' ||
        phase === 'result'
      const isErr = actData.isError || actData.status === 'error'
      const isBlocked = actData.status === 'blocked'

      const status: 'running' | 'success' | 'error' | 'blocked' = isErr
        ? 'error'
        : isBlocked
        ? 'blocked'
        : isFinished
        ? 'success'
        : 'running'

      let outputText = ensureString(
        actData.output || actData.summary || actData.progressText || ''
      )
      if (actData.result?.content) {
        if (Array.isArray(actData.result.content)) {
          outputText = actData.result.content
            .map((c: any) =>
              typeof c === 'string' ? c : ensureString(c?.text || c)
            )
            .join('\n')
        } else if (typeof actData.result.content === 'string') {
          outputText = actData.result.content
        } else if (actData.result.content) {
          outputText = ensureString(actData.result.content)
        }
      }

      const summaryText = ensureString(
        actData.summary || (kind === 'command' ? actData.meta : undefined)
      )
      const inputText = ensureString(
        actData.input
          ? typeof actData.input === 'string'
            ? actData.input
            : JSON.stringify(actData.input, null, 2)
          : ''
      )
      const errorText = ensureString(
        actData.error || (isErr ? outputText : undefined)
      )

      const newEntry: ActivityCardItem = {
        id: key,
        type: kind === 'mcp' ? 'mcp' : 'tool',
        label: title,
        description: summaryText || undefined,
        detail: outputText,
        error: errorText || undefined,
        status,
        input: inputText || undefined,
        startedAt: actData.startedAt,
        endedAt: actData.endedAt,
      }

      setSessions(prev =>
        prev.map(s => {
          if (s.id !== activeSessionId) return s

          const msgs = [...(s.messages || [])]

          // 1. Find if a message containing this activity card already exists
          let targetMsgIdx = msgs.findIndex(m =>
            m.activities?.some(a => a.id === key)
          )

          if (targetMsgIdx >= 0) {
            const targetMsg = msgs[targetMsgIdx]
            const existingActivities = targetMsg.activities || []
            const foundCardIdx = existingActivities.findIndex(a => a.id === key)
            const existingCard = existingActivities[foundCardIdx]

            const mergedCard: ActivityCardItem = {
              id: key,
              type: newEntry.type || existingCard.type,
              label:
                newEntry.label && newEntry.label !== key
                  ? newEntry.label
                  : existingCard.label,
              description: newEntry.description || existingCard.description,
              detail: newEntry.detail || existingCard.detail,
              error: newEntry.error || existingCard.error,
              status: newEntry.status,
              input: newEntry.input || existingCard.input,
              startedAt: existingCard.startedAt || newEntry.startedAt,
              endedAt: existingCard.endedAt || newEntry.endedAt,
            }

            const updatedActivities = existingActivities.map((c, idx) =>
              idx === foundCardIdx ? mergedCard : c
            )
            msgs[targetMsgIdx] = {...targetMsg, activities: updatedActivities}
          } else {
            // New activity card: attach to the current AI turn message
            const currentPendingId = pendingRunsRef.current[activeSessionId]
            let pendingIdx = currentPendingId
              ? msgs.findIndex(m => m.id === currentPendingId)
              : -1

            if (pendingIdx < 0) {
              // If no pending AI message, check if the last message is an AI message
              const lastIdx = msgs.length - 1
              if (lastIdx >= 0 && msgs[lastIdx].sender === 'ai') {
                pendingIdx = lastIdx
                pendingRunsRef.current[activeSessionId] = msgs[lastIdx].id
              } else {
                // Spawn the single AI response message for this turn
                const newAiMsgId = `m-ai-${Date.now()}`
                pendingRunsRef.current[activeSessionId] = newAiMsgId
                const newAiMsg: ChatMessage = {
                  id: newAiMsgId,
                  sender: 'ai',
                  text: '',
                  timestamp: formatChatTimestamp(Date.now()),
                  isStreaming: true,
                  activities: [newEntry],
                }
                msgs.push(newAiMsg)
                return {
                  ...s,
                  messages: msgs,
                }
              }
            }

            const targetAiMsg = msgs[pendingIdx]
            const existingActivities = targetAiMsg.activities || []
            msgs[pendingIdx] = {
              ...targetAiMsg,
              isStreaming: true,
              activities: [...existingActivities, newEntry],
            }
          }

          return {
            ...s,
            messages: msgs,
          }
        })
      )
    }

    const connect = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${wsProtocol}//${window.location.host}${OPENCLAW_BASE_URL}/events/ws`

      try {
        const socket = new WebSocket(wsUrl)
        wsRef.current = socket

        socket.onopen = () => {
          socket.send(JSON.stringify({sessionId: activeSessionId}))
          refreshApprovals()
        }

        socket.onmessage = event => {
          try {
            const payload = JSON.parse(event.data)

            if (
              payload.type === 'approval.requested' ||
              payload.type === 'approval.resolved'
            ) {
              handleApprovalEvent(payload as OpenClawApprovalEventDTO)
              return
            }

            // Handle resync notification from OpenClaw
            if (payload.type === 'sessions.changed') {
              fetchSessions()
              fetchMessages(true)
              refreshApprovals()
              return
            }

            const payloadSessionId =
              payload.sessionId ||
              payload.session?.sessionId ||
              (payload.sessionKey ? payload.sessionKey.split(':').pop() : null)

            if (
              payloadSessionId &&
              activeSessionId &&
              activeSessionId !== 'demo-markdown-session' &&
              payloadSessionId !== activeSessionId &&
              !payload.sessionKey?.includes(activeSessionId)
            ) {
              return
            }

            // Extract Activity / Item Data from top-level payload, payload.data, or payload.activity
            const actData =
              payload.activity ||
              payload.data ||
              (payload.itemId || payload.toolCallId ? payload : null)

            if (actData && (actData.itemId || actData.toolCallId)) {
              // 1. Merge activity card into AI response bubble
              mergeActivityCardIntoSession(actData)

              // 2. Update Subagent Inspector panel task list
              const toolCallId = ensureString(
                actData.toolCallId || actData.itemId || `tool-${Date.now()}`
              )
              const phase = actData.phase || 'start'
              const kind: 'tool' | 'command' | string =
                actData.kind ||
                (actData.itemId?.startsWith('command:') ? 'command' : 'tool')
              const name = ensureString(actData.name || 'exec')
              const title = ensureString(
                actData.title ||
                  actData.meta ||
                  actData.name ||
                  'Tool Execution'
              )
              const metaText = ensureString(
                actData.meta || actData.summary || actData.progressText || ''
              )
              const isEnd =
                phase === 'end' ||
                actData.status === 'completed' ||
                phase === 'result'
              const isErr = actData.isError || actData.status === 'error'

              let outputText = ensureString(actData.output || metaText)
              if (actData.result?.content) {
                if (Array.isArray(actData.result.content)) {
                  outputText = actData.result.content
                    .map((c: any) =>
                      typeof c === 'string' ? c : ensureString(c?.text || c)
                    )
                    .join('\n')
                } else if (typeof actData.result.content === 'string') {
                  outputText = actData.result.content
                } else if (actData.result.content) {
                  outputText = ensureString(actData.result.content)
                }
              }

              const status: 'RUNNING' | 'SUCCESS' | 'ERROR' = isErr
                ? 'ERROR'
                : isEnd
                ? 'SUCCESS'
                : 'RUNNING'
              const progress = isErr
                ? 100
                : isEnd
                ? 100
                : phase === 'start'
                ? 35
                : 70

              const roleLabel =
                kind === 'command' ? `CLI Command (${name})` : `Tool (${name})`

              setSessions(prev =>
                prev.map(s => {
                  if (s.id !== activeSessionId) return s
                  const existingSubs = s.subagents || []
                  const foundIdx = existingSubs.findIndex(
                    sub =>
                      sub.id === toolCallId ||
                      (actData.toolCallId && sub.id === actData.toolCallId)
                  )

                  const existingTask =
                    foundIdx >= 0 ? existingSubs[foundIdx] : null

                  const updatedSubTask: SubagentTask = {
                    id: toolCallId,
                    role:
                      existingTask?.role && kind === 'tool'
                        ? existingTask.role
                        : roleLabel,
                    taskName: title,
                    status,
                    progress: Math.max(existingTask?.progress || 0, progress),
                    latestLog:
                      outputText ||
                      metaText ||
                      existingTask?.latestLog ||
                      (status === 'RUNNING' ? '실행 중...' : '실행 완료'),
                    currentAction: metaText || `Executing ${name}...`,
                    currentStepIndex: isEnd ? 3 : 2,
                    steps: [
                      {title: `요청 수신 (${name})`, status: 'done'},
                      {
                        title: `도구 로직 수행`,
                        status: isEnd ? 'done' : 'active',
                      },
                      {
                        title: `결과 검증 및 출력`,
                        status: isEnd ? 'done' : 'pending',
                      },
                    ],
                    timeline: [
                      {
                        title: `요청 수신 (${name})`,
                        status: 'done',
                      },
                      {
                        title: `도구 로직 수행`,
                        status: isEnd ? 'done' : 'running',
                      },
                      {
                        title: `결과 검증 및 출력`,
                        status: isEnd ? 'done' : 'pending',
                      },
                    ],
                  }

                  let updatedSubs: SubagentTask[]
                  if (foundIdx >= 0) {
                    updatedSubs = existingSubs.map((sub, idx) =>
                      idx === foundIdx
                        ? {...existingTask, ...updatedSubTask}
                        : sub
                    )
                  } else {
                    updatedSubs = [...existingSubs, updatedSubTask]
                  }

                  return {
                    ...s,
                    subagents: updatedSubs,
                  }
                })
              )
            }

            // 2. Real-time streaming delta & full assistant text handling
            if (
              payload.state === 'delta' ||
              payload.deltaText ||
              (payload.message && payload.message.role === 'assistant')
            ) {
              let fullTextFromMsg = ''
              if (
                payload.message?.content &&
                Array.isArray(payload.message.content)
              ) {
                fullTextFromMsg = extractDisplayableText(
                  payload.message.content
                )
              }
              const incomingText = payload.deltaText || fullTextFromMsg

              if (incomingText) {
                setSessions(prev =>
                  prev.map(s => {
                    if (s.id !== activeSessionId) return s

                    const msgs = [...(s.messages || [])]
                    const pendingId = pendingRunsRef.current[activeSessionId]
                    let targetIdx = pendingId
                      ? msgs.findIndex(m => m.id === pendingId)
                      : -1

                    if (targetIdx < 0) {
                      // Check if last message is an AI message to attach to
                      const lastIdx = msgs.length - 1
                      if (lastIdx >= 0 && msgs[lastIdx].sender === 'ai') {
                        targetIdx = lastIdx
                        pendingRunsRef.current[activeSessionId] =
                          msgs[lastIdx].id
                      } else {
                        const newTextMsgId = `m-ai-${Date.now()}`
                        pendingRunsRef.current[activeSessionId] = newTextMsgId
                        const newTextMsg: ChatMessage = {
                          id: newTextMsgId,
                          sender: 'ai',
                          text: incomingText,
                          timestamp: formatChatTimestamp(Date.now()),
                          isStreaming: true,
                          activities: [],
                        }
                        msgs.push(newTextMsg)
                        return {
                          ...s,
                          messages: msgs,
                        }
                      }
                    }

                    // Update existing AI turn message
                    const existingMsg = msgs[targetIdx]
                    let updatedText = existingMsg.text
                    if (
                      fullTextFromMsg &&
                      fullTextFromMsg.length >= existingMsg.text.length
                    ) {
                      updatedText = fullTextFromMsg
                    } else if (payload.deltaText) {
                      updatedText = existingMsg.text + payload.deltaText
                    }
                    msgs[targetIdx] = {
                      ...existingMsg,
                      text: updatedText,
                      isStreaming: true,
                    }

                    return {
                      ...s,
                      messages: msgs,
                    }
                  })
                )
              }
            }

            // 3. Final / Completed / Aborted / Error handling
            if (
              payload.state === 'final' ||
              payload.state === 'completed' ||
              payload.state === 'aborted' ||
              payload.state === 'error'
            ) {
              setIsStreamingActive(false)
              const pendingId = pendingRunsRef.current[activeSessionId]
              delete pendingRunsRef.current[activeSessionId]

              setSessions(prev =>
                prev.map(s => {
                  if (s.id !== activeSessionId) return s
                  return {
                    ...s,
                    messages: (s.messages || []).map(m => {
                      if (pendingId && m.id !== pendingId) return m
                      if (!pendingId && !m.isStreaming) return m
                      const finalDto: OpenClawMessageDTO | undefined =
                        payload.message
                      const textFromFinal = finalDto
                        ? extractDisplayableText(finalDto.content || [])
                        : ''
                      const finalText = textFromFinal || m.text
                      return {
                        ...m,
                        isStreaming: false,
                        timestamp:
                          m.timestamp || formatChatTimestamp(Date.now()),
                        text:
                          finalText ||
                          (payload.state !== 'final' &&
                          payload.state !== 'completed'
                            ? payload.errorMessage ||
                              '응답 처리 중 오류가 발생했습니다.'
                            : m.text),
                        activities: (m.activities || []).map(act => ({
                          ...act,
                          status:
                            act.status === 'running'
                              ? payload.state === 'error'
                                ? 'error'
                                : 'success'
                              : act.status,
                        })),
                      }
                    }),
                  }
                })
              )
              // Sync with official backend history after stream completion
              fetchMessages(true)
            }
          } catch (e) {
            console.warn('[WebSocket Payload Parse Error]', e)
          }
        }

        socket.onclose = () => {
          if (!isTornDown) {
            reconnectTimer = setTimeout(connect, 2000)
          }
        }
      } catch (wsErr: any) {
        console.warn('[WebSocket Connection Error]', wsErr)
      }
    }

    connect()

    return () => {
      isTornDown = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (wsRef.current) wsRef.current.close()
    }
  }, [activeSessionId, handleApprovalEvent, refreshApprovals])

  const activeSession = sessions.find(s => s.id === activeSessionId) || null
  const subagents = activeSession?.subagents || []
  const displayableMessages = (activeSession?.messages || []).filter(
    msg =>
      Boolean(msg.text) || Boolean(msg.activities && msg.activities.length > 0)
  )
  const isAnyAiWorking = displayableMessages.some(
    m =>
      m.sender === 'ai' &&
      m.isStreaming &&
      (Boolean(m.text) || Boolean(m.activities && m.activities.length > 0))
  )
  const approvalIdSetKey = JSON.stringify(
    approvals.map(approval => approval.id).sort()
  )

  const [isUserScrolledUp, setIsUserScrolledUp] = useState<boolean>(false)

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e?.currentTarget
    if (!target) return
    const {scrollTop, scrollHeight, clientHeight} = target
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    if (distanceFromBottom > 100) {
      setIsUserScrolledUp(true)
    } else if (distanceFromBottom <= 40) {
      setIsUserScrolledUp(false)
    }
  }

  const scrollToBottom = useCallback((smooth = true) => {
    setIsUserScrolledUp(false)
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      })
    }
  }, [])

  useEffect(() => {
    if (isLoadingHistory) return

    if (!isUserScrolledUp && messagesEndRef.current) {
      const rafId = requestAnimationFrame(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({
            behavior: isStreamingActive ? 'auto' : 'smooth',
            block: 'end',
          })
        }
      })
      return () => cancelAnimationFrame(rafId)
    }
  }, [
    activeSession?.messages,
    approvalIdSetKey,
    isLoadingHistory,
    isUserScrolledUp,
    isStreamingActive,
  ])

  useEffect(() => {
    if (!isLoadingHistory && activeSessionId) {
      setIsUserScrolledUp(false)
      const timer = setTimeout(() => {
        if (messagesEndRef.current) {
          const scrollContainer = messagesEndRef.current.parentElement
          const needsScroll =
            scrollContainer &&
            scrollContainer.scrollHeight > scrollContainer.clientHeight

          if (needsScroll) {
            messagesEndRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'end',
            })
          }
        }
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [isLoadingHistory, activeSessionId])

  const handleSelectSession = (id: string) => {
    if (activeSessionId === id) return
    setIsStreamingActive(false)
    setActiveSessionId(id)
    setInputPrompt('')
    setIsUserScrolledUp(false)

    if (messagesEndRef.current?.parentElement) {
      messagesEndRef.current.parentElement.scrollTop = 0
    }
  }

  const handleCreateNewChat = () => {
    setActiveSessionId('')
    setInputPrompt('')
    setIsLoadingHistory(false)
    setIsUserScrolledUp(false)
  }

  const handleDeleteSession = async (sessionId: string) => {
    // 1. Optimistically remove from state immediately for responsive UI
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId)
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id)
        } else {
          setActiveSessionId('')
        }
      }
      return remaining
    })

    // 2. Sync deletion with backend
    try {
      await deleteOpenClawSession(sessionId)
    } catch (err: any) {
      console.warn('Failed to delete session on backend:', err)
      triggerErrorNotification(
        `세션 삭제 중 통신 오류 발생: ${err?.message || ''}`
      )
    }
  }

  const MOCK_SKILLS = [
    {
      name: 'cloudhub-code-review',
      command: '/cloudhub-code-review',
      description: 'Go 백엔드 및 React 프론트엔드 변경사항 코드 리뷰',
      category: 'Review',
    },
    {
      name: 'run-security-scanner',
      command: '/run-security-scanner',
      description: '보안 취약점(XSS, SQLi, Secret) 소스코드 스캔',
      category: 'Security',
    },
    {
      name: 'determine-threat-model',
      command: '/determine-threat-model',
      description: '레포지토리 위협 모델 구축 및 진입점/신뢰경계 분석',
      category: 'Security',
    },
    {
      name: 'create-security-implementation-plan',
      command: '/create-security-implementation-plan',
      description: '보안 검증 및 취약점 조치 계획서 자동 생성',
      category: 'Plan',
    },
    {
      name: 'scan_dependencies',
      command: '/scan_dependencies',
      description: '새로운 패키지 의존성 라이선스 및 안전성 검증',
      category: 'Dependency',
    },
    {
      name: 'run-poc',
      command: '/run-poc',
      description: '보안 패치 적용 후 PoC 테스트 수행 및 검증',
      category: 'Test',
    },
  ]

  const PROMPT_SUGGESTIONS = [
    {
      id: 'sug-1',
      icon: '🖥️',
      title: 'WAS 서버 상태 점검',
      prompt: 'was-server-01 점검해줘',
    },
    {
      id: 'sug-2',
      icon: '🌐',
      title: '연결된 서버 목록 조회',
      prompt: '연결된 서버목록 알려줘',
    },
    {
      id: 'sug-3',
      icon: '🔌',
      title: '네트워크 통신 장애 분석',
      prompt:
        'network-repair-demo 네임스페이스에서 frontend가 backend(8080)로 접속이 안 됩니다.',
    },
    {
      id: 'sug-4',
      icon: '🚨',
      title: '주요 Critical 알림 진단',
      prompt:
        '확인해야될 알림 알려줘 ( influxDB에서 alert 뒤져서 12시간 안에 쌓인 critical alert 들 중 꼭 확인해야할 message 알려줘)',
    },
  ]

  const handleSelectSuggestion = (promptText: string) => {
    if (isStreamingActive) return
    handleSendPrompt(promptText)
  }

  const [showSkillMenu, setShowSkillMenu] = useState<boolean>(false)
  const [selectedSkillIndex, setSelectedSkillIndex] = useState<number>(0)

  const filteredSkills = MOCK_SKILLS.filter(skill => {
    if (!inputPrompt.startsWith('/')) return false
    const query = inputPrompt.slice(1).toLowerCase()
    return (
      skill.name.toLowerCase().includes(query) ||
      skill.command.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query)
    )
  })

  const handleSelectSkill = (skillCommand: string) => {
    setInputPrompt(`${skillCommand} `)
    setShowSkillMenu(false)
    if (textareaRef.current) {
      textareaRef.current.focus()
      requestAnimationFrame(adjustTextareaHeight)
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputPrompt(val)
    if (val.startsWith('/')) {
      setShowSkillMenu(true)
      setSelectedSkillIndex(0)
    } else {
      setShowSkillMenu(false)
    }
    requestAnimationFrame(adjustTextareaHeight)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle IME composition (e.g. Korean / CJK text input)
    if (e.nativeEvent.isComposing) {
      return
    }

    if (showSkillMenu && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSkillIndex(prev => (prev + 1) % filteredSkills.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSkillIndex(
          prev => (prev - 1 + filteredSkills.length) % filteredSkills.length
        )
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleSelectSkill(filteredSkills[selectedSkillIndex].command)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSkillMenu(false)
        return
      }
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter: Allow default newline behavior and adjust height
        requestAnimationFrame(adjustTextareaHeight)
        return
      }

      // Enter without Shift: Send message
      e.preventDefault()
      handleSendPrompt()
    }
  }

  const handleSendPrompt = async (promptOverride?: string) => {
    const promptToSend =
      typeof promptOverride === 'string' ? promptOverride : inputPrompt
    if (!promptToSend.trim() || isStreamingActive) return

    const currentPrompt = promptToSend.trim()
    setInputPrompt('')
    setIsUserScrolledUp(false)
    setIsStreamingActive(true)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    let targetSessionId = activeSessionId

    const nowTs = Date.now()
    const userMsgId = `m-${nowTs}`
    const timeStr = formatChatTimestamp(nowTs, effectiveTimeZone)

    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: currentPrompt,
      timestamp: timeStr,
      timestampRaw: nowTs,
    }

    const aiMsgId = `m-ai-${nowTs}`
    const loadingAiMsg: ChatMessage = {
      id: aiMsgId,
      sender: 'ai',
      text: '',
      timestamp: formatChatTimestamp(nowTs, effectiveTimeZone),
      timestampRaw: nowTs,
      isStreaming: true,
      activities: [],
    }

    // 1. If this is a new chat draft (no active session yet), create the session
    if (!targetSessionId) {
      const newSessionTitle = generateDefaultSessionTitle(
        sessionsRef.current || sessions
      )
      try {
        const createRes = await fetch(`${OPENCLAW_BASE_URL}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Organization-Id': 'org-default',
            'X-User-Id': 'user-admin',
          },
          body: JSON.stringify({
            title: newSessionTitle,
          }),
        })

        if (!createRes.ok) {
          setIsStreamingActive(false)
          triggerErrorNotification(
            `세션 생성 실패 (${createRes.status} ${createRes.statusText})`
          )
          return
        }

        const createdDto: OpenClawSessionDTO = await createRes
          .json()
          .catch(() => ({} as any))
        const createdSession: ChatSession = {
          ...toChatSession(createdDto),
          messages: [userMessage, loadingAiMsg],
        }
        targetSessionId = createdSession.id
        pendingRunsRef.current[targetSessionId] = aiMsgId
        setSessions(prev => [createdSession, ...prev])
        setActiveSessionId(targetSessionId)
      } catch (createErr: any) {
        setIsStreamingActive(false)
        triggerErrorNotification(
          `세션 생성 중 통신 오류가 발생했습니다: ${createErr?.message || ''}`
        )
        return
      }
    } else {
      pendingRunsRef.current[targetSessionId] = aiMsgId
      setSessions(prev =>
        prev.map(s => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: [...(s.messages || []), userMessage, loadingAiMsg],
            }
          }
          return s
        })
      )
    }

    try {
      const res = await fetch(
        `${OPENCLAW_BASE_URL}/sessions/${targetSessionId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Organization-Id': 'org-default',
            'X-User-Id': 'user-admin',
          },
          body: JSON.stringify({
            message: currentPrompt,
            idempotencyKey: uuid.v4(),
          }),
        }
      )

      if (!res.ok) {
        setIsStreamingActive(false)
        delete pendingRunsRef.current[targetSessionId]
        if (res.status === 503) {
          triggerErrorNotification(
            'Gateway 연결 오류 (503 Service Unavailable): OpenClaw Gateway를 확인하세요.'
          )
        } else {
          triggerErrorNotification(
            `메시지 전송 실패 (${res.status} ${res.statusText})`
          )
        }
        setSessions(prev =>
          prev.map(s => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                messages: s.messages
                  .filter(m => m.id !== aiMsgId)
                  .map(m => (m.id === userMsgId ? {...m, isFailed: true} : m)),
              }
            }
            return s
          })
        )
      }
    } catch (err: any) {
      setIsStreamingActive(false)
      delete pendingRunsRef.current[targetSessionId]
      triggerErrorNotification(
        `메시지 전송 시 통신 오류가 발생했습니다: ${err?.message || ''}`
      )
      setSessions(prev =>
        prev.map(s => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: s.messages
                .filter(m => m.id !== aiMsgId)
                .map(m => (m.id === userMsgId ? {...m, isFailed: true} : m)),
            }
          }
          return s
        })
      )
    }
  }

  const handleRetryMessage = (failedMsgId: string, text: string) => {
    // 1. Remove the failed message entry
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: s.messages.filter(m => m.id !== failedMsgId),
          }
        }
        return s
      })
    )
    // 2. Immediately send it to chat!
    handleSendPrompt(text)
  }

  const handleToggleSubagentPanel = () => {
    setShowSubagentPanel(prev => {
      const next = !prev
      if (next) {
        if (subagents.some(s => s.status === 'RUNNING')) {
          setActiveInspectorTab('subagent-inspector')
        } else {
          setActiveInspectorTab('activity')
        }
      }
      return next
    })
  }

  const handleCloseSubagentPanel = () => {
    setShowSubagentPanel(false)
  }

  const wrapperClass = classnames(
    'cloudhub-ai-chat-standalone',
    `mode-${mode}`,
    customClass,
    {
      'is-open': isOpen,
    }
  )

  const renderChatThread = () => (
    <div className="chat-thread-container">
      {!chatOnly && (
        <div className="thread-header">
          <div className="thread-title">
            <span>{activeSession?.title || 'OpenClaw AI Ops Chat'}</span>
          </div>
          <div className="thread-header-actions">
            <Button
              text={
                showSubagentPanel
                  ? '패널 닫기'
                  : subagents.length > 0
                  ? `Subagents (${subagents.length})`
                  : targetInspectorMessage?.activities &&
                    targetInspectorMessage.activities.length > 0
                  ? `도구 내역 (${targetInspectorMessage.activities.length})`
                  : '작업 인스펙터'
              }
              color={
                showSubagentPanel || subagents.some(s => s.status === 'RUNNING')
                  ? ComponentColor.Success
                  : ComponentColor.Default
              }
              size={ComponentSize.Small}
              shape={ButtonShape.Default}
              onClick={handleToggleSubagentPanel}
            />
            {mode === 'drawer' && (
              <Button
                text="✕"
                color={ComponentColor.Default}
                size={ComponentSize.Small}
                shape={ButtonShape.Default}
                titleText="Close"
                onClick={onClose}
              />
            )}
          </div>
        </div>
      )}

      <div className="message-list-wrapper">
        <FancyScrollbar
          key={activeSessionId || 'empty-session'}
          autoHide={true}
          setScrollTop={handleScroll}
        >
          <div className="message-list">
            {isLoadingHistory && activeSessionId ? (
              <PageSpinner pageSpinnerHeight="240px" />
            ) : displayableMessages.length === 0 && approvals.length === 0 ? (
              <div className="chat-empty-state">
                <div className="empty-state-hero">
                  <div className="empty-hero-icon">💬</div>
                  <div className="empty-hero-title">
                    새로운 대화를 시작해보세요
                  </div>
                  <div className="empty-hero-subtitle">
                    클러스터 장애 분석, 호스트 점검, 로그 쿼리 등 질문을
                    입력하거나 아래 추천 질문을 선택하세요.
                  </div>
                </div>

                <div className="prompt-suggestions-container">
                  <div className="suggestions-header">추천 질문</div>
                  <div className="suggestions-grid">
                    {PROMPT_SUGGESTIONS.map(sug => (
                      <button
                        key={sug.id}
                        type="button"
                        className="suggestion-card"
                        onClick={() => handleSelectSuggestion(sug.prompt)}
                        title={sug.prompt}
                      >
                        <div className="suggestion-card-top">
                          <span className="suggestion-icon">{sug.icon}</span>
                          <span className="suggestion-title">{sug.title}</span>
                        </div>
                        <div className="suggestion-desc">{sug.prompt}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              displayableMessages.flatMap(msg => {
                if (msg.sender === 'user') {
                  return [
                    <div
                      key={msg.id}
                      className={classnames('message-item user', {
                        'is-failed': msg.isFailed,
                      })}
                    >
                      <div className="message-bubble">
                        <div className="message-text-content">{msg.text}</div>
                        <div className="message-bubble-footer">
                          {msg.isFailed ? (
                            <div className="user-message-failed-row">
                              <span className="failed-label">전송 실패</span>
                              <button
                                type="button"
                                className="retry-send-btn"
                                onClick={() =>
                                  handleRetryMessage(msg.id, msg.text)
                                }
                                title="클릭하여 즉시 재전송"
                              >
                                재시도
                              </button>
                            </div>
                          ) : (
                            (msg.timestampRaw || msg.timestamp) && (
                              <span className="message-timestamp">
                                {formatChatTimestamp(
                                  msg.timestampRaw || msg.timestamp,
                                  effectiveTimeZone
                                )}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      <AiChatMessageAvatar sender="user" />
                    </div>,
                  ]
                }

                const hasActivities = Boolean(
                  msg.activities && msg.activities.length > 0
                )
                const hasText = Boolean(msg.text)
                const isTargetSelected = selectedInspectorMessageId === msg.id

                return (
                  <div key={`msg-${msg.id}`} className="message-item ai">
                    <AiChatMessageAvatar sender="ai" />
                    <div className="message-content-col">
                      {hasActivities ? (
                        <div className="message-bubble has-activities">
                          <div className="ai-tool-activity-summary-bar">
                            <div className="summary-bar-left">
                              <span className="summary-label">
                                {`도구 ${msg.activities!.length}개 실행`}
                              </span>
                            </div>
                            <button
                              type="button"
                              className={classnames(
                                'view-activity-inspector-btn',
                                {
                                  active:
                                    isTargetSelected &&
                                    showSubagentPanel &&
                                    activeInspectorTab === 'activity',
                                }
                              )}
                              onClick={() =>
                                handleOpenActivityInspector(msg.id)
                              }
                              title="우측 패널에서 상세 실행 내역 보기"
                            >
                              작업 내용 보기 ↗
                            </button>
                          </div>

                          {hasText && (
                            <div className="message-text-content">
                              <AiChatMessageMarkdown content={msg.text} />
                              {msg.isStreaming && (
                                <span className="blinking-cursor" />
                              )}
                            </div>
                          )}

                          {!hasText && msg.isStreaming && (
                            <div className="inline-streaming-dots">
                              <span className="loading-dot" />
                              <span className="loading-dot" />
                              <span className="loading-dot" />
                            </div>
                          )}

                          {!msg.isStreaming && (
                            <div className="message-bubble-footer ai-completed-footer">
                              <div className="ai-footer-left">
                                <AiChatBadge variant="done" icon="✓">
                                  답변 완료
                                </AiChatBadge>
                                {(msg.timestampRaw || msg.timestamp) && (
                                  <span className="message-timestamp">
                                    {formatChatTimestamp(
                                      msg.timestampRaw || msg.timestamp,
                                      effectiveTimeZone
                                    )}
                                  </span>
                                )}
                              </div>
                              <div className="ai-footer-actions">
                                {hasText && (
                                  <button
                                    type="button"
                                    className={classnames('ai-copy-btn', {
                                      copied: copiedMessageId === msg.id,
                                    })}
                                    onClick={() =>
                                      handleCopyMessageText(msg.id, msg.text)
                                    }
                                    title="답변 내용 복사"
                                  >
                                    {copiedMessageId === msg.id
                                      ? '복사됨'
                                      : '복사'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="message-bubble">
                          {hasText && (
                            <div className="message-text-content">
                              <AiChatMessageMarkdown content={msg.text} />
                              {msg.isStreaming && (
                                <span className="blinking-cursor" />
                              )}
                            </div>
                          )}

                          {!msg.isStreaming && (
                            <div className="message-bubble-footer ai-completed-footer">
                              <div className="ai-footer-left">
                                <AiChatBadge variant="done" icon="✓">
                                  답변 완료
                                </AiChatBadge>
                                {(msg.timestampRaw || msg.timestamp) && (
                                  <span className="message-timestamp">
                                    {formatChatTimestamp(
                                      msg.timestampRaw || msg.timestamp,
                                      effectiveTimeZone
                                    )}
                                  </span>
                                )}
                              </div>
                              <div className="ai-footer-actions">
                                {hasText && (
                                  <button
                                    type="button"
                                    className={classnames('ai-copy-btn', {
                                      copied: copiedMessageId === msg.id,
                                    })}
                                    onClick={() =>
                                      handleCopyMessageText(msg.id, msg.text)
                                    }
                                    title="답변 내용 복사"
                                  >
                                    {copiedMessageId === msg.id
                                      ? '복사됨'
                                      : '복사'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {msg.action === 'BLOCKED' && (
                        <AiChatBadge variant="blocked" size="md">
                          Security Gateway Intercepted (Dropped in Trash)
                        </AiChatBadge>
                      )}
                      {msg.action === 'REDACTED' && (
                        <AiChatBadge variant="redacted" size="md">
                          Sensitive Secret / PII Data Masked
                        </AiChatBadge>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            {approvals.map(approval => (
              <div
                key={`approval-${approval.id}`}
                className="message-item ai approval-message-item"
              >
                <AiChatMessageAvatar sender="tool" />
                <OpenClawApprovalCard
                  approval={approval}
                  now={now}
                  onResolve={resolveApproval}
                />
              </div>
            ))}
            {isStreamingActive && !isAnyAiWorking && (
              <div
                key="active-streaming-global-indicator"
                className="message-item ai is-indicator"
              >
                <AiChatMessageAvatar sender="ai" />
                <div className="message-content-col">
                  <div className="streaming-dots-standalone">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </FancyScrollbar>

        {isUserScrolledUp && displayableMessages.length > 0 && (
          <button
            type="button"
            className="scroll-to-bottom-btn"
            onClick={() => scrollToBottom(true)}
            title="최신 메시지로 이동"
          >
            <span className="scroll-arrow">↓</span>
            <span className="scroll-label">최신 메시지</span>
            {isStreamingActive && <span className="streaming-dot-pulse" />}
          </button>
        )}
      </div>

      <div className="composer-footer">
        {showSkillMenu && filteredSkills.length > 0 && (
          <div className="slash-skill-menu">
            <div className="slash-skill-header">
              <span>Available Skills & Commands</span>
              <span className="slash-skill-hint">
                ↑↓ 키로 이동, Enter로 선택
              </span>
            </div>
            <div className="slash-skill-list">
              {filteredSkills.map((skill, index) => (
                <div
                  key={skill.name}
                  className={classnames('slash-skill-item', {
                    active: index === selectedSkillIndex,
                  })}
                  onClick={() => handleSelectSkill(skill.command)}
                >
                  <div className="skill-main">
                    <span className="skill-command">{skill.command}</span>
                    <span className="skill-name">{skill.name}</span>
                  </div>
                  <div className="skill-desc">{skill.description}</div>
                  <AiChatBadge variant="category" size="sm">
                    {skill.category}
                  </AiChatBadge>
                </div>
              ))}
            </div>
          </div>
        )}
        <textarea
          ref={textareaRef}
          className={classnames('chat-textarea', {
            'is-just-completed': isJustCompleted,
          })}
          placeholder={
            isStreamingActive
              ? 'AI가 답변을 생성하고 있습니다...'
              : "Cloudhub AI Ops 장애 분석 및 조치 명령을 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈, '/': 스킬 목록)"
          }
          value={inputPrompt}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isStreamingActive}
        />
        <Button
          text={isStreamingActive ? '생성 중...' : '전송'}
          color={
            isStreamingActive ? ComponentColor.Default : ComponentColor.Success
          }
          size={ComponentSize.Small}
          shape={ButtonShape.Default}
          onClick={() => handleSendPrompt()}
          status={
            isStreamingActive
              ? ComponentStatus.Disabled
              : ComponentStatus.Default
          }
        />
      </div>
    </div>
  )

  const renderSubagentInspectorPanel = () => (
    <SubagentInspectorPanel
      subagents={subagents}
      activeTaskId={selectedTaskId}
      onSelectTaskId={setSelectedTaskId}
      subagentFilter={subagentFilter}
      onSetSubagentFilter={setSubagentFilter}
      onClosePanel={handleCloseSubagentPanel}
      defaultViewMode={subagentDefaultView}
      customViews={customPanelViews}
      activeInspectorTab={activeInspectorTab}
      onChangeInspectorTab={setActiveInspectorTab}
      turns={conversationTurns}
      selectedTurnId={selectedInspectorMessageId}
      onSelectTurnId={setSelectedInspectorMessageId}
    />
  )

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(
    defaultSidebarCollapsed
  )

  useEffect(() => {
    if (defaultSidebarCollapsed && isOpen) {
      setIsSidebarCollapsed(true)
    }
  }, [defaultSidebarCollapsed, isOpen])

  return (
    <div className={wrapperClass}>
      <div className="chat-layout">
        <AiChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          isCollapsed={isSidebarCollapsed}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onCreateNewChat={handleCreateNewChat}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        />

        {chatOnly ? (
          renderChatThread()
        ) : (
          <CollapsibleSidePanelSlice
            isOpen={showSubagentPanel}
            onClose={() => setShowSubagentPanel(false)}
            defaultRatio={0.42}
            snapCloseThreshold={120}
            panelContent={renderSubagentInspectorPanel()}
            onResize={() => requestAnimationFrame(adjustTextareaHeight)}
          >
            {renderChatThread()}
          </CollapsibleSidePanelSlice>
        )}
      </div>
    </div>
  )
}

interface StateProps {
  persistedTimeZone?: TimeZones
}

const mSTP = (state: {
  app?: {persisted?: {timeZone?: TimeZones}}
}): StateProps => ({
  persistedTimeZone: state.app?.persisted?.timeZone,
})

const mDTP = {
  notify: notifyAction,
}

export const CloudhubAiChatStandalone = connect(
  mSTP,
  mDTP
)(CloudhubAiChatStandaloneUnconnected)
export default CloudhubAiChatStandalone
