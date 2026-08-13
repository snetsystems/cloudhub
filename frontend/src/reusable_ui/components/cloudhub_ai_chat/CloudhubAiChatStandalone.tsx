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

// Cloudhub Threesizer Component & Constants
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import {HANDLE_VERTICAL} from 'src/shared/constants'

// Cloudhub Reusable Components
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import AiChatSidebar from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatSidebar'
import SubagentInspectorPanel, {CustomPanelView} from 'src/reusable_ui/components/cloudhub_ai_chat/SubagentInspectorPanel'
import AiChatMessageMarkdown from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatMessageMarkdown'

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

export interface ChatMessage {
  id: string
  sender: 'user' | 'ai' | 'system'
  text: string
  timestamp: string
  action?: 'ALLOW' | 'BLOCKED' | 'REDACTED'
  toolCommand?: string
  stdout?: string
  isStreaming?: boolean
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
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [inputPrompt, setInputPrompt] = useState<string>('')
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(false)
  const [showSubagentPanel, setShowSubagentPanel] = useState<boolean>(false)
  const [subagentFilter, setSubagentFilter] = useState<'ALL' | 'RUNNING' | 'SUCCESS' | 'ERROR'>('ALL')
  const [subagentPanelProportions, setSubagentPanelProportions] = useState<number[]>([0.55, 0.45])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true)
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
    if (!activeSessionId) return

    const fetchMessages = async () => {
      setIsLoadingHistory(true)
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
        setIsLoadingHistory(false)
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
            const targetSessionId = payload.sessionId || (payload.sessionKey ? payload.sessionKey.split(':').pop() : null)
            if (targetSessionId && targetSessionId !== activeSessionId && !payload.sessionKey?.includes(activeSessionId)) {
              return
            }

            if (payload.state === 'delta' && payload.deltaText) {
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
            } else if (payload.state === 'final' || payload.state === 'aborted' || payload.state === 'error') {
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
                          text: finalText || (payload.state !== 'final' ? payload.errorMessage || '응답 처리 중 오류가 발생했습니다.' : m.text),
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

        socket.onclose = ev => {
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
  }, [activeSessionId])

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || null
  const subagents = activeSession?.subagents || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'})
  }, [activeSession?.messages])

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id)
  }

  const handleCreateNewChat = async () => {
    try {
      const res = await fetch(`${OPENCLAW_BASE_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-Id': 'org-default',
          'X-User-Id': 'user-admin',
        },
        body: JSON.stringify({
          title: `신규 OpenClaw 대화 세션 ${sessions.length + 1}`,
        }),
      })

      if (!res.ok) return

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
      const res = await fetch(`${OPENCLAW_BASE_URL}/sessions/${activeSessionId}/messages`, {
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
        delete pendingRunsRef.current[activeSessionId]
        if (res.status === 503) {
          triggerErrorNotification('Gateway 연결 오류 (503 Service Unavailable): OpenClaw Gateway를 확인하세요.')
        } else {
          triggerErrorNotification(`메시지 전송 실패 (${res.status} ${res.statusText})`)
        }
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
