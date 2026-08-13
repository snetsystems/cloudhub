import React, {useState, useRef, useEffect, ChangeEvent, KeyboardEvent, FC} from 'react'
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
import Input from 'src/reusable_ui/components/inputs/Input'
import RadioButtons from 'src/reusable_ui/components/radio_buttons/RadioButtons'

// Cloudhub Threesizer Component & Constants
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import {HANDLE_VERTICAL} from 'src/shared/constants'

// Cloudhub FancyScrollbar Component
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import AiChatSidebar from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatSidebar'
import SubagentInspectorPanel, {CustomPanelView} from 'src/reusable_ui/components/cloudhub_ai_chat/SubagentInspectorPanel'
import AiChatMessageMarkdown from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatMessageMarkdown'
import AiChatMessageAvatar, {ChatMessageSender} from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatMessageAvatar'
import AiChatSystemActivityLog, {AiChatToolExecutionLog, SystemActivityEntry} from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatSystemActivityLog'

// Cloudhub Redux Notification Action & Helpers
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifyErrorWithAltText, defaultErrorNotification} from 'src/shared/copy/notifications'
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

export interface ChatMessage {
  id: string
  sender: ChatMessageSender
  text: string
  timestamp: string
  action?: 'ALLOW' | 'BLOCKED' | 'REDACTED'
  toolCommand?: string
  stdout?: string
  isStreaming?: boolean
  systemActivity?: SystemActivityEntry[]
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

// Wire shapes returned by the CloudHub OpenClaw REST endpoints (backend/server/openclaw_chat.go)
export interface OpenClawActivityDTO {
  itemId: string
  toolCallId?: string
  phase: string
  kind?: string
  name?: string
  title?: string
  status?: string
  summary?: string
  error?: string
  input?: string
  output?: string
  truncated?: boolean
  startedAt?: number
  endedAt?: number
}

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

const toChatMessage = (dto: OpenClawMessageDTO, index: number): ChatMessage | null => {
  if (dto.role === 'system') return null

  const text = extractDisplayableText(dto.content || [])
  if (!text.trim() && dto.role !== 'user') return null

  return {
    id: `${dto.timestamp}-${index}`,
    sender: dto.role === 'user' ? 'user' : dto.role === 'assistant' ? 'ai' : 'system',
    text,
    timestamp: dto.timestamp ? new Date(dto.timestamp).toLocaleTimeString() : '',
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
  // Default initial demo session with rich markdown sample messages for immediate UI testing
  const DEFAULT_DEMO_SESSION: ChatSession = {
    id: 'demo-markdown-session',
    title: 'Markdown Formatting & Subagent Demo',
    updatedAt: new Date().toLocaleTimeString(),
    messages: [
      {
        id: 'user-demo-1',
        sender: 'user',
        text: 'CloudHub AI 시스템 및 서브에이전트 현황 보고서를 마크다운 표, 이미지, 코드 블록 형식으로 생성해줘.',
        timestamp: '10:44:00',
      },
      {
        id: 'ai-demo-1',
        sender: 'ai',
        text: `# CloudHub AI Ops 마크다운 서식 종합 테스트

[Pasted text #1 +26 lines]
/tmp/orca-paste-1786524551924-31438492-9b47-4da1-ad0d-bb1491894487.png

> **System Alert**: 서브에이전트 샌드박스 진단 결과 일부 서비스 인스턴스에 자원 집중 현상이 감지되었습니다.

### 1. 클러스터 노드 현황 요약 (GFM Table)

| 서비스/파드 명 | 실행 상태 | CPU 사용률 | 메모리 점유량 | 비고 |
|---|---|---|---|---|
| \`openclaw-gateway-v2\` | Healthy | \`14.2%\` | 512 MB | 메인 오케스트레이터 |
| \`subagent-worker-01\` | Active | \`78.5%\` | 2.1 GB | 파이프라인 분석 중 |
| \`subagent-worker-02\` | Idle | \`4.1%\` | 380 MB | 작업 대기 |
| \`influxdb-telemetry\` | Warning | \`94.8%\` | 7.8 GB | 메모리 임계치 임박 |

---

### 2. 서브에이전트 실행 코드 샘플 (Code Block with Copy Button)

\`\`\`typescript
import { SubagentTask } from 'src/reusable_ui/components/cloudhub_ai_chat'

export async function runDiagnostics(taskId: string): Promise<SubagentTask> {
  console.log(\`[Orchestrator] Dispatching task \${taskId}...\`)
  return {
    id: taskId,
    role: 'Security & Performance Inspector',
    taskName: 'CloudHub Node Health Check',
    status: 'RUNNING',
    progress: 85,
    latestLog: 'Analyzing memory consumption on influxdb-telemetry node',
  }
}
\`\`\`

### 3. 세부 진단 서식 및 링크 (Formatting & Media)

- **강조 서식**: **긴급 조치 필요**, *실시간 모니터링 중*, ~~구버전 1.0 API 파이프라인~~
- **붙여넣기 칩 테스트**: [Pasted text #2 +14 lines]
- **외부 참조 링크**: [CloudHub OpenClaw Documentation](https://cloudhub.snet.co.kr/docs)
- **첨부 이미지 미리보기**:
![CloudHub Architecture](https://raw.githubusercontent.com/github/explore/80688e429a7d4ef2fca1e82350fe8e3517d3494d/topics/react/react.png)
`,
        timestamp: '10:44:05',
        systemActivity: [
          {
            id: 'act-1',
            type: 'skill',
            label: 'cloudhub-code-review',
            description: '보고서 생성 전 최신 백엔드/프론트엔드 변경사항 리뷰 수행',
            input: '{\n  "mode": "thorough",\n  "diffRange": "HEAD~3..HEAD"\n}',
            status: 'success',
          },
          {
            id: 'act-2',
            type: 'mcp',
            label: 'mcp__filesystem__read_file (Large Log)',
            description: '클러스터 노드 메트릭 스냅샷 대용량 로그 파일 읽기',
            input: '{\n  "path": "/var/log/cloudhub/metrics_stream.log",\n  "maxBytes": 16384\n}',
            detail: '[{"timestamp": 1723500000, "node": "worker-01", "cpu": 78.5, "mem_mb": 2148}, {"timestamp": 1723500005, "node": "worker-01", "cpu": 82.1, "mem_mb": 2210}, ... 15,800 bytes truncated preview mode ...]',
            truncated: true,
            status: 'success',
          },
          {
            id: 'act-3',
            type: 'security',
            label: 'Secret Masking',
            description: '응답 본문에서 API 키 패턴 감지 및 마스킹 처리',
            status: 'success',
          },
        ],
      },
      {
        id: 'system-demo-1',
        sender: 'system',
        text: 'OpenClaw Gateway가 이 세션의 보안 정책을 실시간으로 적용하고 있습니다. 민감 정보는 자동으로 마스킹됩니다.',
        timestamp: '10:44:06',
      },
      {
        id: 'user-demo-2',
        sender: 'user',
        text: '/run-security-scanner 실행해줘',
        timestamp: '10:45:10',
      },
      {
        id: 'skill-demo-1',
        sender: 'skill',
        text: '**run-security-scanner** 스킬 실행 결과: 취약점 2건 발견 (Medium 1건, Low 1건). 상세 내역은 Subagent Inspector에서 확인할 수 있습니다.',
        timestamp: '10:45:14',
        systemActivity: [
          {
            id: 'act-4',
            type: 'tool',
            label: 'run-security-scanner',
            description: '소스코드 정적 분석(XSS, SQLi, Secret 패턴) 스캔',
            input: '{\n  "targetPath": "frontend/src",\n  "rules": ["xss", "sqli", "secret"]\n}',
            detail: 'Vulnerabilities: 2 (Medium: 1, Low: 1)',
            status: 'success',
          },
          {
            id: 'act-5',
            type: 'tool',
            label: 'read non_existent_file.txt',
            description: '존재하지 않는 구성 파일 읽기 시도',
            input: '{\n  "path": "non_existent_file.txt"\n}',
            error: 'Error: Tool read failed: file non_existent_file.txt does not exist (ENOENT)',
            status: 'error',
          },
          {
            id: 'act-6',
            type: 'mcp',
            label: 'mcp__github__list_findings',
            description: '스캔 결과를 GitHub 이슈 트래커 포맷으로 변환 중',
            input: '{\n  "repo": "snetsystems/cloudhub",\n  "state": "open"\n}',
            status: 'running',
          },
        ],
      },
    ],
  }

  const [sessions, setSessions] = useState<ChatSession[]>([DEFAULT_DEMO_SESSION])
  const [activeSessionId, setActiveSessionId] = useState<string>('demo-markdown-session')
  const [inputPrompt, setInputPrompt] = useState<string>('')
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(false)
  const [showSubagentPanel, setShowSubagentPanel] = useState<boolean>(true)
  const [subagentFilter, setSubagentFilter] = useState<'ALL' | 'RUNNING' | 'SUCCESS' | 'ERROR'>('ALL')
  const [subagentPanelProportions, setSubagentPanelProportions] = useState<number[]>([0.55, 0.45])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [inspectorViewMode, setInspectorViewMode] = useState<'terminal' | 'character'>(subagentDefaultView)
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pendingRunsRef = useRef<Record<string, string>>({})

  const triggerErrorNotification = (msg: string) => {
    if (notify) {
      notify({
        ...defaultErrorNotification,
        message: msg,
      })
    } else {
      console.error('[OpenClaw AI Chat Error]:', msg)
    }
  }

  // 1. Fetch real session list on component mount
  const fetchSessions = async () => {
    try {
      const res = await fetch(`${OPENCLAW_BASE_URL}/sessions`, {
        credentials: 'include',
        headers: {
          'X-Organization-Id': 'org-default',
          'X-User-Id': 'user-admin',
        },
      })
      if (!res.ok) {
        return
      }
      const data: {sessions: OpenClawSessionDTO[]} = await res.json()
      const loadedSessions = (data.sessions || []).map(toChatSession)
      if (loadedSessions.length > 0) {
        setSessions([DEFAULT_DEMO_SESSION, ...loadedSessions])
      }
    } catch (err: any) {
      console.warn('[OpenClaw AI Chat]: Backend REST endpoint offline, showing demo session.')
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  // 2. Fetch history messages & connect WebSocket when active session changes
  useEffect(() => {
    if (!activeSessionId || activeSessionId === 'demo-markdown-session') return

    const fetchMessages = async () => {
      setIsLoadingHistory(true)
      try {
        const res = await fetch(`${OPENCLAW_BASE_URL}/rpc`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Organization-Id': 'org-default',
            'X-User-Id': 'user-admin',
          },
          body: JSON.stringify({
            method: 'chat.history',
            sessionId: activeSessionId,
            params: {
              limit: 100,
              maxChars: 100000,
            },
          }),
        })
        if (!res.ok) {
          triggerErrorNotification(`메시지 히스토리 로드 실패 (${res.status})`)
          return
        }
        const data: {messages?: OpenClawMessageDTO[]} = await res.json()
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
        triggerErrorNotification(`메시지 내역 조회 실패: ${err?.message || ''}`)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    fetchMessages()

    // Setup Realtime WebSocket connection for event stream
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

    const connect = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${wsProtocol}//${window.location.host}${OPENCLAW_BASE_URL}/events/ws`

      try {
        const socket = new WebSocket(wsUrl)
        wsRef.current = socket

        socket.onopen = () => {
          socket.send(JSON.stringify({sessionId: activeSessionId}))
        }

        socket.onmessage = event => {
          try {
            const payload = JSON.parse(event.data)
            // Real OpenClaw event envelope (backend/server/openclaw_chat.go openClawEventDTO):
            // {type: 'chat', sessionId, state: 'delta'|'final'|'aborted'|'error', deltaText, message, errorMessage, ...}
            if (payload.type === 'chat' && payload.state === 'delta' && payload.deltaText) {
              const pendingId = pendingRunsRef.current[activeSessionId]
              if (pendingId) {
                setSessions(prev =>
                  prev.map(s => {
                    if (s.id !== activeSessionId) return s
                    return {
                      ...s,
                      messages: s.messages.map(m =>
                        m.id === pendingId ? {...m, text: m.text + payload.deltaText} : m
                      ),
                    }
                  })
                )
              }
            } else if (
              payload.type === 'chat' &&
              (payload.state === 'final' || payload.state === 'aborted' || payload.state === 'error')
            ) {
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
                        if (textFromFinal) {
                          return {
                            ...m,
                            isStreaming: false,
                            text: textFromFinal,
                          }
                        }
                        if (payload.state !== 'final' && !m.text) {
                          return {
                            ...m,
                            isStreaming: false,
                            text: payload.errorMessage || '응답 처리 중 오류가 발생했습니다.',
                          }
                        }
                        return {...m, isStreaming: false}
                      }),
                    }
                  })
                )
              }
              if (payload.state === 'error' || payload.state === 'aborted') {
                triggerErrorNotification(
                  `AI 응답 처리 실패 (${payload.state}): ${payload.errorMessage || payload.errorKind || '알 수 없는 오류'}`
                )
              }
            } else if (payload.type === 'activity' || payload.activity) {
              const act: OpenClawActivityDTO = payload.activity || payload
              if (act && (act.itemId || act.toolCallId)) {
                const actId = act.itemId || act.toolCallId!
                const actKind = (act.kind || 'tool').toLowerCase()
                const actType: SystemActivityType =
                  actKind === 'skill'
                    ? 'skill'
                    : actKind === 'mcp'
                    ? 'mcp'
                    : actKind === 'security'
                    ? 'security'
                    : 'tool'

                let calcStatus: SystemActivityStatus = 'running'
                if (act.phase === 'output') {
                  if (act.status === 'error' || act.error) {
                    calcStatus = 'error'
                  } else if (act.status === 'blocked') {
                    calcStatus = 'blocked'
                  } else {
                    calcStatus = 'success'
                  }
                } else if (act.status) {
                  calcStatus = (act.status as SystemActivityStatus) || 'running'
                }

                setSessions(prev =>
                  prev.map(s => {
                    if (s.id !== activeSessionId) return s
                    const pendingId = pendingRunsRef.current[activeSessionId]
                    const msgList = s.messages
                    let targetIdx = -1
                    if (pendingId) {
                      targetIdx = msgList.findIndex(m => m.id === pendingId)
                    }
                    if (targetIdx === -1) {
                      for (let i = msgList.length - 1; i >= 0; i--) {
                        if (msgList[i].sender === 'ai' || msgList[i].sender === 'skill') {
                          targetIdx = i
                          break
                        }
                      }
                    }
                    if (targetIdx === -1 && msgList.length > 0) {
                      targetIdx = msgList.length - 1
                    }
                    if (targetIdx === -1) return s

                    const targetMsg = msgList[targetIdx]
                    const existingActivities = targetMsg.systemActivity || []
                    const actIdx = existingActivities.findIndex(a => a.id === actId)

                    let updatedActivities: SystemActivityEntry[]
                    if (actIdx >= 0) {
                      updatedActivities = existingActivities.map((a, idx) => {
                        if (idx !== actIdx) return a
                        return {
                          ...a,
                          label: act.title || act.name || a.label,
                          description: act.summary !== undefined ? act.summary : a.description,
                          input: act.input !== undefined && act.input !== '' ? act.input : a.input,
                          detail: act.output !== undefined && act.output !== '' ? act.output : a.detail,
                          truncated: act.truncated !== undefined ? act.truncated : a.truncated,
                          error: act.error !== undefined && act.error !== '' ? act.error : a.error,
                          status: calcStatus,
                        }
                      })
                    } else {
                      const newEntry: SystemActivityEntry = {
                        id: actId,
                        type: actType,
                        label: act.title || act.name || actId,
                        description: act.summary,
                        input: act.input,
                        detail: act.output,
                        truncated: act.truncated,
                        error: act.error,
                        status: calcStatus,
                      }
                      updatedActivities = [...existingActivities, newEntry]
                    }

                    const updatedMessages = msgList.map((m, idx) =>
                      idx === targetIdx ? {...m, systemActivity: updatedActivities} : m
                    )
                    return {...s, messages: updatedMessages}
                  })
                )
              }
            } else if (payload.type === 'subagent_event' && payload.subagent) {
              // Handle real live subagent updates from OpenClaw gateway
              setSessions(prev =>
                prev.map(s => {
                  if (s.id === activeSessionId) {
                    const existingSubs = s.subagents || []
                    const subIdx = existingSubs.findIndex(sub => sub.id === payload.subagent.id)
                    let newSubs: SubagentTask[]
                    if (subIdx >= 0) {
                      newSubs = existingSubs.map((sub, i) => i === subIdx ? {...sub, ...payload.subagent} : sub)
                    } else {
                      newSubs = [payload.subagent, ...existingSubs]
                    }
                    return {...s, subagents: newSubs}
                  }
                  return s
                })
              )
            }
          } catch (e) {
            console.warn('[WebSocket Payload Parse Error]', e)
          }
        }

        socket.onerror = () => {
          triggerErrorNotification('WebSocket 실시간 이벤트 연결 중 오류가 발생했습니다.')
        }

        socket.onclose = ev => {
          setIsStreamingActive(false)
          if (ev.code === 1008) {
            triggerErrorNotification('권한이 없는 세션 구독 시도로 WebSocket 연결이 차단되었습니다 (Code 1008).')
            return
          }
          // Any drop mid-stream must release the composer and resolve the
          // pending bubble, otherwise both stay stuck forever waiting for a
          // 'final' event that will never arrive on this dead socket.
          finalizePendingRun('연결이 끊어져 응답을 받지 못했습니다.')
          if (!isTornDown) {
            reconnectTimer = setTimeout(connect, 2000)
          }
        }
      } catch (wsErr: any) {
        triggerErrorNotification(`WebSocket 소켓 생성 실패: ${wsErr?.message || ''}`)
      }
    }

    connect()

    return () => {
      isTornDown = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [activeSessionId])

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || null
  const subagents = activeSession?.subagents || []

  // Keep the thread pinned to the latest message, including streamed deltas.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'})
  }, [activeSession?.messages])

  const filteredSubagents = subagents.filter(sub => {
    if (subagentFilter === 'ALL') return true
    return sub.status === subagentFilter
  })

  const activeSubagent = subagents.find(s => s.id === selectedTaskId) || subagents[0]

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id)
  }

  // Real REST API POST session creation
  const handleCreateNewChat = async () => {
    try {
      const res = await fetch(`${OPENCLAW_BASE_URL}/sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': 'org-default',
          'X-User-Id': 'user-admin',
        },
        body: JSON.stringify({
          title: `신규 OpenClaw 대화 세션 ${sessions.length + 1}`,
        }),
      })

      if (!res.ok) {
        triggerErrorNotification(`새 대화 세션 생성 실패 (${res.status} ${res.statusText})`)
        return
      }

      const createdDto: OpenClawSessionDTO = await res.json()
      const createdSession = toChatSession(createdDto)
      setSessions(prev => [createdSession, ...prev])
      setActiveSessionId(createdSession.id)
    } catch (err: any) {
      triggerErrorNotification(`세션 생성 중 오류 발생: ${err?.message || ''}`)
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
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputPrompt(val)
    if (val.startsWith('/')) {
      setShowSkillMenu(true)
      setSelectedSkillIndex(0)
    } else {
      setShowSkillMenu(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
      handleSendPrompt()
    }
  }

  // Real REST API POST message dispatching
  const handleSendPrompt = async () => {
    if (!inputPrompt.trim() || isStreamingActive) return

    const currentPrompt = inputPrompt
    setInputPrompt('')
    setIsStreamingActive(true)

    const userMsgId = `m-${Date.now()}`
    const timeStr = new Date().toLocaleTimeString()

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
      timestamp: new Date().toLocaleTimeString(),
      isStreaming: true,
    }

    pendingRunsRef.current[activeSessionId] = aiMsgId

    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...(s.messages || []), userMessage, loadingAiMsg],
          }
        }
        return s
      })
    )

    try {
      let targetSessionId = activeSessionId
      if (!targetSessionId || targetSessionId === 'demo-markdown-session') {
        const sessionRes = await fetch(`${OPENCLAW_BASE_URL}/sessions`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Organization-Id': 'org-default',
            'X-User-Id': 'user-admin',
          },
          body: JSON.stringify({
            title: currentPrompt.slice(0, 30) || 'AI Ops 대화 세션',
          }),
        })
        if (sessionRes.ok) {
          const createdDto: OpenClawSessionDTO = await sessionRes.json()
          const createdSession = toChatSession(createdDto)
          setSessions(prev => [createdSession, ...prev])
          setActiveSessionId(createdSession.id)
          targetSessionId = createdSession.id
        }
      }

      const res = await fetch(`${OPENCLAW_BASE_URL}/rpc`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': 'org-default',
          'X-User-Id': 'user-admin',
        },
        body: JSON.stringify({
          method: 'chat.send',
          sessionId: targetSessionId,
          params: {
            message: currentPrompt,
            timeoutMs: 10000,
            idempotencyKey: uuid.v4(),
          },
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
        return
      }

      // Fetch updated history using chat.history RPC method
      const historyRes = await fetch(`${OPENCLAW_BASE_URL}/rpc`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': 'org-default',
          'X-User-Id': 'user-admin',
        },
        body: JSON.stringify({
          method: 'chat.history',
          sessionId: targetSessionId,
          params: {
            limit: 100,
            maxChars: 100000,
          },
        }),
      })

      if (historyRes.ok) {
        const rawOpenClawHistory = await historyRes.json()
        const msgs = (rawOpenClawHistory.messages || [])
          .map(toChatMessage)
          .filter((m): m is ChatMessage => m !== null)

        if (msgs.length > 0) {
          setSessions(prev =>
            prev.map(s => {
              if (s.id !== targetSessionId) return s
              const fetchedIds = new Set(msgs.map(m => m.id))
              const localOnly = (s.messages || []).filter(m => !fetchedIds.has(m.id))
              return { ...s, messages: [...msgs, ...localOnly] }
            })
          )
        }
      }
    } catch (err: any) {
      setIsStreamingActive(false)
      delete pendingRunsRef.current[activeSessionId]
      triggerErrorNotification(`메시지 전송 시 통신 오류가 발생했습니다: ${err?.message || ''}`)
      setSessions(prev =>
        prev.map(s => {
          if (s.id === activeSessionId) {
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

  const handleSetSubagentFilter = (
    filter: 'ALL' | 'RUNNING' | 'SUCCESS' | 'ERROR'
  ) => {
    setSubagentFilter(filter)
  }

  const handleThreesizerResize = (proportions: number[]) => {
    setSubagentPanelProportions(proportions)
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
                : 'Subagent Inspector'
            }
            color={
              showSubagentPanel
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
            {isLoadingHistory ? (
              <div style={{padding: '60px 20px', textAlign: 'center', color: '#a0aec0', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'}}>
                <span className="loading-dots-container" style={{transform: 'scale(1.3)'}}>
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                </span>
                <span>대화 내역을 불러오는 중입니다...</span>
              </div>
            ) : (activeSession?.messages || []).length === 0 ? (
              <div style={{padding: '40px 20px', textAlign: 'center', color: '#718096', fontSize: '13px'}}>
                대화 세션이 없습니다. 좌측 상단 [+ New Chat] 버튼을 눌러 새 대화를 시작해보세요.
              </div>
            ) : (
              activeSession!.messages
                .filter(msg => msg.text || msg.isStreaming)
                .map(msg => (
              <div
                key={msg.id}
                className={classnames('message-item', msg.sender)}
              >
                <AiChatMessageAvatar sender={msg.sender} />

                <div className="message-content-col">
                  <div
                    className={classnames('message-bubble', {
                      'is-loading': !msg.text && msg.isStreaming,
                    })}
                  >
                    {!msg.text && msg.isStreaming ? (
                      <span className="loading-dots-container">
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                        <span className="loading-dot" />
                      </span>
                    ) : (
                      <>
                        <AiChatMessageMarkdown content={msg.text} />
                        {msg.isStreaming && <span className="blinking-cursor" />}
                      </>
                    )}
                  </div>

                  {msg.timestamp && !(msg.isStreaming && !msg.text) && (
                    <div className="message-timestamp">{msg.timestamp}</div>
                  )}

                  {msg.toolCommand &&
                    msg.toolCommand !== 'NONE (BLOCKED BY GATEWAY)' && (
                      <div className="tool-call-card">
                        <div className="tool-header">
                          Executed Tool Command
                        </div>
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

                  <AiChatToolExecutionLog
                    entries={(msg.systemActivity || []).filter(a => a.type !== 'security')}
                  />
                  <AiChatSystemActivityLog
                    entries={(msg.systemActivity || []).filter(a => a.type === 'security')}
                  />
                </div>
              </div>
            )))}
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
        <Input
          customClass="chat-input"
          placeholder="Cloudhub AI Ops 장애 분석 및 조치 명령을 입력하세요... ('/'를 입력하여 스킬 목록 보기)"
          value={inputPrompt}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          status={
            isStreamingActive
              ? ComponentStatus.Disabled
              : ComponentStatus.Default
          }
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
          onCreateNewChat={handleCreateNewChat}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        />

        {showSubagentPanel ? (
          <Threesizer
            orientation={HANDLE_VERTICAL}
            divisions={[
              {
                name: 'Chat Thread',
                headerButtons: [],
                menuOptions: [],
                size: subagentPanelProportions[0],
                render: renderChatThread,
              },
              {
                name: 'Subagent Inspector',
                headerButtons: [],
                menuOptions: [],
                size: subagentPanelProportions[1],
                minPixels: 360,
                render: renderSubagentInspectorPanel,
              },
            ]}
            onResize={handleThreesizerResize}
          />
        ) : (
          renderChatThread()
        )}
      </div>
    </div>
  )
}

const mDTP = {
  notify: notifyAction,
}

export const CloudhubAiChatStandalone = connect(null, mDTP)(CloudhubAiChatStandaloneUnconnected)
export default CloudhubAiChatStandalone
