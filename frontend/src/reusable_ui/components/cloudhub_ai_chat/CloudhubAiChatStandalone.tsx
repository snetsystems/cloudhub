import React, {useState, useRef, useEffect, useCallback, ChangeEvent, KeyboardEvent, FC} from 'react'
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
import AiChatSidebar from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatSidebar'
import SubagentInspectorPanel, {CustomPanelView} from 'src/reusable_ui/components/cloudhub_ai_chat/SubagentInspectorPanel'
import AiChatMessageMarkdown from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatMessageMarkdown'
import AiChatMessageAvatar from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatMessageAvatar'
import OpenClawApprovalCard from 'src/reusable_ui/components/cloudhub_ai_chat/OpenClawApprovalCard'
import {
  deleteOpenClawSession,
  OpenClawApprovalEventDTO,
} from 'src/reusable_ui/components/cloudhub_ai_chat/openclawApi'
import {useOpenClawApprovals} from 'src/reusable_ui/components/cloudhub_ai_chat/useOpenClawApprovals'

// Cloudhub Redux Notification Action & Helpers
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {defaultErrorNotification} from 'src/shared/copy/notifications'
import {connect} from 'react-redux'

// SCSS Theme Styling (Influx / SNet Color Variables)
import './CloudhubAiChatStandalone.scss'

export interface SubagentTask {
  id: string
  role: string
  taskName: string
  status: 'RUNNING' | 'SUCCESS' | 'ERROR' | 'QUEUED'
  progress: number
  latestLog: string
  characterAvatar?: string
  currentStepIndex?: number
  steps?: { title: string; status: 'done' | 'active' | 'pending' | 'error' }[]
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
  action?: 'ALLOW' | 'BLOCKED' | 'REDACTED'
  toolCommand?: string
  stdout?: string
  isStreaming?: boolean
  activities?: ActivityCardItem[]
}

export interface ChatSession {
  id: string
  title: string
  updatedAt: string
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
  messages: [],
})

export const generateDefaultSessionTitle = (sessionList: ChatSession[]): string => {
  let maxNum = sessionList.length
  sessionList.forEach(s => {
    const match = s.title?.match(/신규\s*(?:OpenClaw\s*)?대화\s*세션\s*#?(\d+)/i)
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
  if ((!trimmed.startsWith('{') || !trimmed.endsWith('}')) && (!trimmed.startsWith('[') || !trimmed.endsWith(']'))) {
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

const extractDisplayableText = (contentParts: OpenClawContentPart[]): string => {
  if (!contentParts || contentParts.length === 0) return ''
  return contentParts
    .filter(part => {
      const text = part.text || ''
      if (isJsonString(text)) return false
      if (isRawToolErrorMessage(text)) return false
      return true
    })
    .map(part => part.text)
    .join('')
}

const AiChatToolExecutionCard: FC<{ card: ActivityCardItem }> = ({ card }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  const durationMs =
    card.startedAt && card.endedAt && card.endedAt >= card.startedAt
      ? card.endedAt - card.startedAt
      : null

  const durationText =
    durationMs !== null
      ? durationMs < 1000
        ? `${durationMs}ms`
        : `${(durationMs / 1000).toFixed(2)}s`
      : null

  const badgeClass = card.status.toLowerCase()
  const badgeLabel =
    card.status === 'running'
      ? '실행 중...'
      : card.status === 'success'
      ? '완료'
      : card.status === 'error'
      ? '오류'
      : '차단됨'

  const hasDetails = Boolean(card.input || card.detail || card.error || durationText)

  return (
    <div className={classnames('activity-card-box', badgeClass)}>
      <div className="activity-card-header">
        <div className="activity-card-title">
          <span className="activity-type-tag">{card.type === 'mcp' ? 'MCP' : 'TOOL'}</span>
          <span className="activity-label">{card.label}</span>
        </div>
        <span className={classnames('activity-status-badge', badgeClass)}>
          {badgeLabel}
        </span>
      </div>

      {card.description && (
        <div className="activity-card-description">{card.description}</div>
      )}

      {hasDetails && (
        <div className="activity-card-footer">
          <button
            type="button"
            className="activity-card-toggle-btn"
            onClick={() => setIsExpanded(prev => !prev)}
          >
            {isExpanded ? '▲ 접기' : '▼ [입력 / 출력 / 실행 시간 보기]'}
          </button>
          {durationText && <span className="activity-duration">{durationText}</span>}
        </div>
      )}

      {isExpanded && hasDetails && (
        <div className="activity-card-expanded">
          {card.input && (
            <div className="activity-detail-block">
              <div className="detail-title">📥 입력 (Input):</div>
              <pre className="detail-pre"><code>{card.input}</code></pre>
            </div>
          )}
          {card.detail && (
            <div className="activity-detail-block">
              <div className="detail-title">📤 출력 (Output):</div>
              <pre className="detail-pre"><code>{card.detail}</code></pre>
            </div>
          )}
          {card.error && (
            <div className="activity-detail-block error-block">
              <div className="detail-title">⚠️ 오류 (Error):</div>
              <pre className="detail-pre error-pre"><code>{card.error}</code></pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const formatChatTimestamp = (timestamp?: number | string | Date): string => {
  if (!timestamp) {
    return new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
  }
  const d = typeof timestamp === 'number' || typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  if (isNaN(d.getTime())) {
    return new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
  }
  return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
}

const toChatMessage = (dto: OpenClawMessageDTO, index: number): ChatMessage | null => {
  if (dto.role === 'system') return null

  const text = extractDisplayableText(dto.content || [])
  if (!text.trim() && dto.role !== 'user') return null

  return {
    id: `${dto.timestamp || Date.now()}-${index}`,
    sender: dto.role === 'user' ? 'user' : dto.role === 'assistant' ? 'ai' : 'system',
    text,
    timestamp: formatChatTimestamp(dto.timestamp),
  }
}

interface ComponentProps extends CloudhubAiChatProps {
  notify?: (notification: any) => void
}

export const CloudhubAiChatStandaloneUnconnected: FC<ComponentProps> = ({
  mode = 'drawer',
  isOpen = true,
  onClose,
  customClass,
  subagentDefaultView = 'character',
  customPanelViews = [],
  notify,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [inputPrompt, setInputPrompt] = useState<string>('')
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(false)
  const [showSubagentPanel, setShowSubagentPanel] = useState<boolean>(false)
  const [subagentFilter, setSubagentFilter] = useState<'ALL' | 'RUNNING' | 'SUCCESS' | 'ERROR'>('ALL')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingRunsRef = useRef<Record<string, string>>({})
  const sessionsRef = useRef<ChatSession[]>(sessions)

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 38), 160)
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
  }, [sessions])

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

  // Original clean session fetcher
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
      const data: {sessions: OpenClawSessionDTO[]} = await res.json()
      const loadedSessions = (data.sessions || []).map(toChatSession)
      if (loadedSessions.length > 0) {
        setSessions(loadedSessions)
        setActiveSessionId(loadedSessions[0].id)
      } else {
        setIsLoadingHistory(false)
      }
    } catch (err: any) {
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
      const currentSession = sessionsRef.current.find(s => s.id === activeSessionId)
      const hasExistingMessages = Boolean(currentSession && currentSession.messages && currentSession.messages.length > 0)

      if (!isBackground && !hasExistingMessages) {
        setIsLoadingHistory(true)
      }
      try {
        const res = await fetch(`${OPENCLAW_BASE_URL}/sessions/${activeSessionId}/messages`, {
          headers: {
            'X-Organization-Id': 'org-default',
            'X-User-Id': 'user-admin',
          },
        })
        if (!res.ok) return

        const data: {messages: OpenClawMessageDTO[]} = await res.json()
        const msgs = (data.messages || [])
          .map(toChatMessage)
          .filter((m): m is ChatMessage => m !== null)
        setSessions(prev =>
          prev.map(s => {
            if (s.id !== activeSessionId) return s
            const fetchedIds = new Set(msgs.map(m => m.id))
            const localOnly = (s.messages || []).filter(m => !fetchedIds.has(m.id))
            return {...s, messages: [...msgs, ...localOnly]}
          })
        )
      } catch (err: any) {
        console.warn('[OpenClaw AI Chat]: Failed to fetch message history:', err)
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

    const finalizePendingRun = (fallbackText: string) => {
      const pendingId = pendingRunsRef.current[activeSessionId]
      if (!pendingId) return
      delete pendingRunsRef.current[activeSessionId]
      setSessions(prev =>
        prev.map(s => {
          if (s.id !== activeSessionId) return s
          return {
            ...s,
            messages: s.messages.map(m =>
              m.id === pendingId && m.isStreaming
                ? {...m, isStreaming: false, text: m.text || fallbackText}
                : m
            ),
          }
        })
      )
    }

    const mergeActivityCardIntoSession = (actData: any) => {
      if (!actData) return
      const key = actData.toolCallId || actData.itemId || `act-${Date.now()}`
      const phase = actData.phase || 'start'
      const kind = actData.kind || 'tool'
      const title = actData.title || actData.meta || actData.name || key
      const isFinished = phase === 'end' || phase === 'output' || actData.status === 'completed' || phase === 'result'
      const isErr = actData.isError || actData.status === 'error'
      const isBlocked = actData.status === 'blocked'

      const status: 'running' | 'success' | 'error' | 'blocked' = isErr
        ? 'error'
        : isBlocked
        ? 'blocked'
        : isFinished
        ? 'success'
        : 'running'

      let outputText = actData.output || actData.summary || actData.progressText || ''
      if (actData.result?.content) {
        outputText = actData.result.content.map((c: any) => c.text || '').join('\n')
      }

      const newEntry: ActivityCardItem = {
        id: key,
        type: kind === 'mcp' ? 'mcp' : 'tool',
        label: title,
        description: actData.summary || (kind === 'command' ? actData.meta : undefined),
        detail: outputText,
        error: actData.error || (isErr ? outputText : undefined),
        status,
        input: actData.input,
        startedAt: actData.startedAt,
        endedAt: actData.endedAt,
      }

      setSessions(prev =>
        prev.map(s => {
          if (s.id !== activeSessionId) return s

          const msgs = [...(s.messages || [])]

          // 1. Find if a message containing this activity card already exists
          let targetMsgIdx = msgs.findIndex(m => m.activities?.some(a => a.id === key))

          if (targetMsgIdx >= 0) {
            const targetMsg = msgs[targetMsgIdx]
            const existingActivities = targetMsg.activities || []
            const foundCardIdx = existingActivities.findIndex(a => a.id === key)
            const existingCard = existingActivities[foundCardIdx]

            const mergedCard: ActivityCardItem = {
              id: key,
              type: newEntry.type || existingCard.type,
              label: newEntry.label && newEntry.label !== key ? newEntry.label : existingCard.label,
              description: newEntry.description || existingCard.description,
              detail: newEntry.detail || existingCard.detail,
              error: newEntry.error || existingCard.error,
              status: newEntry.status,
              input: newEntry.input || existingCard.input,
              startedAt: existingCard.startedAt || newEntry.startedAt,
              endedAt: newEntry.endedAt || existingCard.endedAt,
            }

            const updatedActivities = existingActivities.map((c, idx) => (idx === foundCardIdx ? mergedCard : c))
            msgs[targetMsgIdx] = { ...targetMsg, activities: updatedActivities }
          } else {
            // Close streaming on prior text segment if present
            const currentPendingId = pendingRunsRef.current[activeSessionId]
            if (currentPendingId) {
              const pendingIdx = msgs.findIndex(m => m.id === currentPendingId)
              if (pendingIdx >= 0) {
                if (msgs[pendingIdx].text) {
                  msgs[pendingIdx] = { ...msgs[pendingIdx], isStreaming: false }
                } else {
                  // Remove empty placeholder message
                  msgs.splice(pendingIdx, 1)
                }
              }
              delete pendingRunsRef.current[activeSessionId]
            }

            // Create a dedicated separate message item for this tool execution card and append in order
            const newActMsg: ChatMessage = {
              id: `act-msg-${key}`,
              sender: 'ai',
              text: '',
              timestamp: formatChatTimestamp(Date.now()),
              activities: [newEntry],
            }
            msgs.push(newActMsg)
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
              const toolCallId = actData.toolCallId || actData.itemId || `tool-${Date.now()}`
              const phase = actData.phase || 'start'
              const kind: 'tool' | 'command' | string = actData.kind || (actData.itemId?.startsWith('command:') ? 'command' : 'tool')
              const name = actData.name || 'exec'
              const title = actData.title || actData.meta || actData.name || 'Tool Execution'
              const metaText = actData.meta || actData.summary || actData.progressText || ''
              const isEnd = phase === 'end' || actData.status === 'completed' || phase === 'result'
              const isErr = actData.isError || actData.status === 'error'

              let outputText = actData.output || metaText
              if (actData.result?.content) {
                outputText = actData.result.content.map((c: any) => c.text || '').join('\n')
              }

              const status: 'RUNNING' | 'SUCCESS' | 'ERROR' = isErr ? 'ERROR' : isEnd ? 'SUCCESS' : 'RUNNING'
              const progress = isErr ? 100 : isEnd ? 100 : phase === 'start' ? 35 : 70

              const roleLabel = kind === 'command'
                ? `CLI Command (${name})`
                : `Tool (${name})`

              setSessions(prev =>
                prev.map(s => {
                  if (s.id !== activeSessionId) return s
                  const existingSubs = s.subagents || []
                  const foundIdx = existingSubs.findIndex(
                    sub => sub.id === toolCallId || (actData.toolCallId && sub.id === actData.toolCallId)
                  )

                  const existingTask = foundIdx >= 0 ? existingSubs[foundIdx] : null

                  const updatedSubTask: SubagentTask = {
                    id: toolCallId,
                    role: existingTask?.role && kind === 'tool' ? existingTask.role : roleLabel,
                    taskName: title,
                    status: isEnd && existingTask?.status === 'SUCCESS' ? 'SUCCESS' : status,
                    progress: Math.max(existingTask?.progress || 0, progress),
                    latestLog: outputText || existingTask?.latestLog || (status === 'RUNNING' ? '실행 중...' : '실행 완료'),
                    currentStepIndex: isEnd ? 3 : 2,
                    steps: [
                      { title: `도구/명령어 호출 (${name})`, status: 'done' },
                      { title: `실행 (${kind === 'command' ? '시스템 명령' : '도구 실행'})`, status: isEnd ? 'done' : 'active' },
                      { title: `결과 검증 및 출력`, status: isEnd ? 'done' : 'pending' },
                    ],
                  }

                  let updatedSubs: SubagentTask[]
                  if (foundIdx >= 0) {
                    updatedSubs = existingSubs.map((sub, idx) => (idx === foundIdx ? { ...existingTask, ...updatedSubTask } : sub))
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
            if (payload.state === 'delta' || payload.deltaText || (payload.message && payload.message.role === 'assistant')) {
              let fullTextFromMsg = ''
              if (payload.message?.content && Array.isArray(payload.message.content)) {
                fullTextFromMsg = extractDisplayableText(payload.message.content)
              }
              const incomingText = payload.deltaText || fullTextFromMsg

              if (incomingText) {
                setSessions(prev =>
                  prev.map(s => {
                    if (s.id !== activeSessionId) return s

                    const msgs = [...(s.messages || [])]
                    const pendingId = pendingRunsRef.current[activeSessionId]
                    const targetIdx = pendingId ? msgs.findIndex(m => m.id === pendingId) : -1

                    if (targetIdx < 0) {
                      // Spawn a NEW text response segment message in chronological order!
                      const newTextMsgId = `m-text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
                      pendingRunsRef.current[activeSessionId] = newTextMsgId
                      const newTextMsg: ChatMessage = {
                        id: newTextMsgId,
                        sender: 'ai',
                        text: incomingText,
                        timestamp: formatChatTimestamp(Date.now()),
                        isStreaming: true,
                      }
                      msgs.push(newTextMsg)
                    } else {
                      // Update existing streaming text message segment
                      const existingMsg = msgs[targetIdx]
                      let updatedText = existingMsg.text
                      if (fullTextFromMsg && fullTextFromMsg.length >= existingMsg.text.length) {
                        updatedText = fullTextFromMsg
                      } else if (payload.deltaText) {
                        updatedText = existingMsg.text + payload.deltaText
                      }
                      msgs[targetIdx] = {
                        ...existingMsg,
                        text: updatedText,
                        isStreaming: true,
                      }
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
            if (payload.state === 'final' || payload.state === 'completed' || payload.state === 'aborted' || payload.state === 'error') {
              setIsStreamingActive(false)
              const pendingId = pendingRunsRef.current[activeSessionId]
              if (pendingId) {
                delete pendingRunsRef.current[activeSessionId]
                setSessions(prev =>
                  prev.map(s => {
                    if (s.id !== activeSessionId) return s
                    return {
                      ...s,
                      messages: s.messages.map(m => {
                        if (m.id !== pendingId) return m
                        const finalDto: OpenClawMessageDTO | undefined = payload.message
                        const textFromFinal = finalDto ? extractDisplayableText(finalDto.content || []) : ''
                        const finalText = textFromFinal || m.text
                        return {
                          ...m,
                          isStreaming: false,
                          timestamp: m.timestamp || formatChatTimestamp(Date.now()),
                          text: finalText || (payload.state !== 'final' && payload.state !== 'completed' ? payload.errorMessage || '응답 처리 중 오류가 발생했습니다.' : m.text),
                        }
                      }),
                    }
                  })
                )
              }
            }
          } catch (e) {
            console.warn('[WebSocket Payload Parse Error]', e)
          }
        }

        socket.onclose = () => {
          setIsStreamingActive(false)
          finalizePendingRun('연결이 끊어져 응답을 받지 못했습니다.')
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
    msg => msg.text || msg.isStreaming || (msg.activities && msg.activities.length > 0)
  )
  const approvalIdSetKey = JSON.stringify(
    approvals.map(approval => approval.id).sort()
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'})
  }, [activeSession?.messages, approvalIdSetKey])

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id)
    setInputPrompt('')
  }

  const handleCreateNewChat = () => {
    setActiveSessionId('')
    setInputPrompt('')
    setIsLoadingHistory(false)
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
      triggerErrorNotification(`세션 삭제 중 통신 오류 발생: ${err?.message || ''}`)
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
        setSelectedSkillIndex(prev => (prev - 1 + filteredSkills.length) % filteredSkills.length)
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

  const handleSendPrompt = async () => {
    if (!inputPrompt.trim() || isStreamingActive) return

    const currentPrompt = inputPrompt.trim()
    setInputPrompt('')
    setIsStreamingActive(true)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    let targetSessionId = activeSessionId

    const userMsgId = `m-${Date.now()}`
    const timeStr = formatChatTimestamp(Date.now())

    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: currentPrompt,
      timestamp: timeStr,
    }

    const aiMsgId = `m-ai-${Date.now()}`
    const loadingAiMsg: ChatMessage = {
      id: aiMsgId,
      sender: 'ai',
      text: '',
      timestamp: formatChatTimestamp(Date.now()),
      isStreaming: true,
    }

    // 1. If this is a new chat draft (no active session yet), create the session
    if (!targetSessionId) {
      const newSessionTitle = generateDefaultSessionTitle(sessionsRef.current || sessions)
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
          triggerErrorNotification(`세션 생성 실패 (${createRes.status} ${createRes.statusText})`)
          return
        }

        const createdDto: OpenClawSessionDTO = await createRes.json()
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
        triggerErrorNotification(`세션 생성 중 통신 오류가 발생했습니다: ${createErr?.message || ''}`)
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
      const res = await fetch(`${OPENCLAW_BASE_URL}/sessions/${targetSessionId}/messages`, {
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
      })

      if (!res.ok) {
        setIsStreamingActive(false)
        delete pendingRunsRef.current[targetSessionId]
        if (res.status === 503) {
          triggerErrorNotification('Gateway 연결 오류 (503 Service Unavailable): OpenClaw Gateway를 확인하세요.')
        } else {
          triggerErrorNotification(`메시지 전송 실패 (${res.status} ${res.statusText})`)
        }
        setSessions(prev =>
          prev.map(s => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                messages: s.messages.filter(m => m.id !== aiMsgId),
              }
            }
            return s
          })
        )
      }
    } catch (err: any) {
      setIsStreamingActive(false)
      delete pendingRunsRef.current[targetSessionId]
      triggerErrorNotification(`메시지 전송 시 통신 오류가 발생했습니다: ${err?.message || ''}`)
      setSessions(prev =>
        prev.map(s => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: s.messages.filter(m => m.id !== aiMsgId),
            }
          }
          return s
        })
      )
    }
  }

  const handleToggleSubagentPanel = () => {
    setShowSubagentPanel(prev => !prev)
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
      <div className="thread-header">
        <div className="thread-title">
          <span>{activeSession?.title || 'OpenClaw AI Ops Chat'}</span>
        </div>
        <div className="thread-header-actions">
          <Button
            text={
              showSubagentPanel
                ? 'Hide Subagents'
                : subagents.length > 0
                ? `Subagent Inspector (${subagents.length})`
                : 'Subagent Inspector'
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
              text="✕ Close"
              color={ComponentColor.Default}
              size={ComponentSize.Small}
              shape={ButtonShape.Default}
              onClick={onClose}
            />
          )}
        </div>
      </div>

      <div className="message-list-wrapper">
        <FancyScrollbar autoHide={true}>
          <div className="message-list">
            {isLoadingHistory && activeSessionId ? (
              <div style={{padding: '60px 20px', textAlign: 'center', color: '#a0aec0', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'}}>
                <span className="loading-dots-container" style={{transform: 'scale(1.3)'}}>
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                </span>
                <span>대화 내역을 불러오는 중입니다...</span>
              </div>
            ) : displayableMessages.length === 0 && approvals.length === 0 ? (
              <div style={{padding: '60px 20px', textAlign: 'center', color: '#718096', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                <div style={{fontSize: '24px', marginBottom: '4px'}}>💬</div>
                <div style={{fontWeight: 'bold', color: '#e2e8f0'}}>새로운 대화를 시작해보세요</div>
                <div style={{fontSize: '12px', color: '#a0aec0'}}>질문이나 분석할 로그/명령어를 입력하면 자동으로 대화 세션이 생성됩니다.</div>
              </div>
            ) : (
              displayableMessages.flatMap(msg => {
                  if (msg.sender === 'user') {
                    return [(
                      <div key={msg.id} className="message-item user">
                        <div className="message-bubble">
                          <div className="message-text-content">{msg.text}</div>
                          {msg.timestamp && (
                            <div className="message-bubble-footer">
                              <span className="message-timestamp">{msg.timestamp}</span>
                            </div>
                          )}
                        </div>
                        <AiChatMessageAvatar sender="user" />
                      </div>
                    )]
                  }

                  const elements: React.ReactNode[] = []

                  // Render each tool card as its own individual chat message bubble
                  if (msg.activities && msg.activities.length > 0) {
                    msg.activities.forEach(card => {
                      elements.push(
                        <div key={`act-${msg.id}-${card.id}`} className="message-item ai activity-message-item">
                          <AiChatMessageAvatar sender="tool" />
                          <div className="message-bubble activity-message-bubble">
                            <AiChatToolExecutionCard card={card} />
                          </div>
                        </div>
                      )
                    })
                  }

                  // Render assistant text response or streaming indicator as a separate chat message bubble
                  const hasText = Boolean(msg.text)
                  const isStreamingNoText = msg.isStreaming && !hasText

                  if (hasText || isStreamingNoText) {
                    elements.push(
                      <div key={`text-${msg.id}`} className="message-item ai">
                        <AiChatMessageAvatar sender="ai" />
                        <div className="message-content-col">
                          <div
                            className={classnames('message-bubble', {
                              'is-loading': isStreamingNoText,
                            })}
                          >
                            {isStreamingNoText ? (
                              <span className="loading-dots-container">
                                <span className="loading-dot" />
                                <span className="loading-dot" />
                                <span className="loading-dot" />
                              </span>
                            ) : (
                              <>
                                <div className="message-text-content">
                                  {msg.text && <AiChatMessageMarkdown content={msg.text} />}
                                  {msg.isStreaming && <span className="blinking-cursor" />}
                                </div>
                                {msg.timestamp && (
                                  <div className="message-bubble-footer">
                                    <span className="message-timestamp">{msg.timestamp}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {msg.toolCommand && msg.toolCommand !== 'NONE (BLOCKED BY GATEWAY)' && (
                            <div className="tool-call-card">
                              <div className="tool-header">Executed Tool Command</div>
                              <div className="code-block">
                                <code>{msg.toolCommand}</code>
                              </div>
                            </div>
                          )}

                          {msg.action === 'BLOCKED' && (
                            <div className="security-badge blocked">
                              Security Gateway Intercepted (Dropped in Trash)
                            </div>
                          )}
                          {msg.action === 'REDACTED' && (
                            <div className="security-badge redacted">
                              Sensitive Secret / PII Data Masked
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  return elements
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
            <div ref={messagesEndRef} />
          </div>
        </FancyScrollbar>
      </div>

      <div className="composer-footer">
        {showSkillMenu && filteredSkills.length > 0 && (
          <div className="slash-skill-menu">
            <div className="slash-skill-header">
              <span>Available Skills & Commands</span>
              <span className="slash-skill-hint">↑↓ 키로 이동, Enter로 선택</span>
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
                  <span className="skill-category-badge">{skill.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Cloudhub AI Ops 장애 분석 및 조치 명령을 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈, '/': 스킬 목록)"
          value={inputPrompt}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isStreamingActive}
        />
        <Button
          text="전송"
          color={ComponentColor.Success}
          size={ComponentSize.Small}
          shape={ButtonShape.Default}
          onClick={handleSendPrompt}
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
      onClosePanel={handleToggleSubagentPanel}
      defaultViewMode={subagentDefaultView}
      customViews={customPanelViews}
    />
  )

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false)

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
      </div>
    </div>
  )
}

const mDTP = {
  notify: notifyAction,
}

export const CloudhubAiChatStandalone = connect(null, mDTP)(CloudhubAiChatStandaloneUnconnected)
export default CloudhubAiChatStandalone
