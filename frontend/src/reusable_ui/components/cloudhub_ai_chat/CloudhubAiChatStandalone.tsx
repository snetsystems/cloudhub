import React, {Component, ChangeEvent, KeyboardEvent} from 'react'
import classnames from 'classnames'

// Types & Cloudhub Reusable Button Component Reuse
import {
  ComponentColor,
  ComponentSize,
  ButtonShape,
  ComponentStatus,
} from 'src/reusable_ui/types'
import Button from 'src/reusable_ui/components/Button'

// SCSS Styling
import './CloudhubAiChatStandalone.scss'

export interface SubagentTask {
  id: string
  role: string
  taskName: string
  status: 'RUNNING' | 'SUCCESS' | 'ERROR' | 'QUEUED'
  progress: number
  latestLog: string
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
}

interface State {
  sessions: ChatSession[]
  activeSessionId: string
  inputPrompt: string
  isStreamingActive: boolean
  showSubagentPanel: boolean
  subagentFilter: 'ALL' | 'RUNNING' | 'SUCCESS' | 'ERROR'
}

export class CloudhubAiChatStandalone extends Component<
  CloudhubAiChatProps,
  State
> {
  public static defaultProps: Partial<CloudhubAiChatProps> = {
    mode: 'drawer',
    isOpen: true,
  }

  constructor(props: CloudhubAiChatProps) {
    super(props)
    const initialSessionId = 'sess-1'
    this.state = {
      showSubagentPanel: false,
      subagentFilter: 'ALL',
      sessions: [
        {
          id: initialSessionId,
          title: 'App-Server-01 메모리 장애 진단 세션',
          updatedAt: '10분 전',
          messages: [
            {
              id: 'm1',
              sender: 'ai',
              text:
                '🌐 안녕하세요! Cloudhub AI Ops 관제 어시스턴트입니다. 모니터링 중인 서버 장애 조치 및 보안 가드레일 통제를 도와드립니다.',
              timestamp: new Date().toLocaleTimeString(),
            },
          ],
          subagents: [
            {
              id: 'sub-1',
              role: 'DataMiner-1',
              taskName: 'App Server 로그 수집 및 정제',
              status: 'RUNNING',
              progress: 65,
              latestLog: 'Fetching dataset, processing records 1-50k...',
            },
            {
              id: 'sub-2',
              role: 'CodeGen-2',
              taskName: 'K8s Deployment 롤백 스크립트 작성',
              status: 'SUCCESS',
              progress: 100,
              latestLog: 'Generated rollback.yaml successfully',
            },
            {
              id: 'sub-3',
              role: 'AlertNotify-1',
              taskName: 'Slack 팀 채널 장애 알림 송출',
              status: 'ERROR',
              progress: 85,
              latestLog: 'ERROR: Slack API connection failed - Retry scheduled',
            },
            {
              id: 'sub-4',
              role: 'Validate-1',
              taskName: '인프라 리소스 건전성 검증',
              status: 'QUEUED',
              progress: 0,
              latestLog: 'Waiting for DataMiner-1 completion...',
            },
          ],
        },
        {
          id: 'sess-2',
          title: 'DB 커넥션 억제 패치 세션',
          updatedAt: '어제',
          messages: [],
          subagents: [],
        },
      ],
      activeSessionId: initialSessionId,
      inputPrompt: '',
      isStreamingActive: false,
    }
  }

  private get activeSession(): ChatSession {
    const {sessions, activeSessionId} = this.state
    return sessions.find(s => s.id === activeSessionId) || sessions[0]
  }

  private handleSelectSession = (id: string) => {
    this.setState({activeSessionId: id})
  }

  private handleCreateNewChat = () => {
    const newId = `sess-${Date.now()}`
    const newSession: ChatSession = {
      id: newId,
      title: `신규 AI Ops 대화 세션 ${this.state.sessions.length + 1}`,
      updatedAt: '방금 전',
      messages: [
        {
          id: 'm-init',
          sender: 'ai',
          text:
            '🌐 새로운 대화 세션이 시작되었습니다. 조치할 명령이나 에러 상태를 입력해 주세요.',
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
    }
    this.setState(prev => ({
      sessions: [newSession, ...prev.sessions],
      activeSessionId: newId,
    }))
  }

  private handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({inputPrompt: e.target.value})
  }

  private handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.handleSendPrompt()
    }
  }

  private handleSendPrompt = async () => {
    const {inputPrompt, activeSessionId, isStreamingActive} = this.state
    if (!inputPrompt.trim() || isStreamingActive) return

    const userMsgId = `m-${Date.now()}`
    const timeStr = new Date().toLocaleTimeString()

    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: inputPrompt,
      timestamp: timeStr,
    }

    // Update session with user message
    this.setState(prev => ({
      inputPrompt: '',
      isStreamingActive: true,
      sessions: prev.sessions.map(s => {
        if (s.id === activeSessionId) {
          return {...s, messages: [...s.messages, userMessage]}
        }
        return s
      }),
    }))

    // Trigger REST API (/api/gateway/chat) & Stream Response Typing Animation
    try {
      const res = await fetch('/api/gateway/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt: inputPrompt}),
      })
      const data = await res.json()
      const evalResult = data.evalResult || {}
      const targetExec = evalResult.targetExecution || {}

      const fullOutputText =
        targetExec.stdout || evalResult.reason || '조치 조회가 완료되었습니다.'

      // Append initial AI streaming message
      const aiMsgId = `m-ai-${Date.now()}`
      const initialAiMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: '',
        timestamp: new Date().toLocaleTimeString(),
        action: evalResult.action,
        toolCommand: targetExec.executedCommand,
        stdout: targetExec.stdout,
        isStreaming: true,
      }

      this.setState(prev => ({
        sessions: prev.sessions.map(s => {
          if (s.id === activeSessionId) {
            return {...s, messages: [...s.messages, initialAiMsg]}
          }
          return s
        }),
      }))

      // Simulate 촤르륵 Typing Animation (ChatGPT Style)
      let currentText = ''
      for (let i = 0; i < fullOutputText.length; i++) {
        currentText += fullOutputText[i]
        await new Promise(r => setTimeout(r, 20)) // 20ms interval typing

        this.setState(prev => ({
          sessions: prev.sessions.map(s => {
            if (s.id === activeSessionId) {
              const updatedMessages = s.messages.map(m => {
                if (m.id === aiMsgId) {
                  return {
                    ...m,
                    text: currentText,
                    isStreaming: i < fullOutputText.length - 1,
                  }
                }
                return m
              })
              return {...s, messages: updatedMessages}
            }
            return s
          }),
        }))
      }
    } catch (err) {
      console.error('Security Gateway API Call Error:', err)
    } finally {
      this.setState({isStreamingActive: false})
    }
  }

  private handleToggleSubagentPanel = () => {
    this.setState(prev => ({showSubagentPanel: !prev.showSubagentPanel}))
  }

  private handleSetSubagentFilter = (
    filter: 'ALL' | 'RUNNING' | 'SUCCESS' | 'ERROR'
  ) => {
    this.setState({subagentFilter: filter})
  }

  public render() {
    const {mode, isOpen, onClose, customClass} = this.props
    const {
      sessions,
      activeSessionId,
      inputPrompt,
      isStreamingActive,
      showSubagentPanel,
      subagentFilter,
    } = this.state
    const activeSession = this.activeSession
    const subagents = activeSession.subagents || []

    const filteredSubagents = subagents.filter(sub => {
      if (subagentFilter === 'ALL') return true
      return sub.status === subagentFilter
    })

    const wrapperClass = classnames(
      'cloudhub-ai-chat-standalone',
      `mode-${mode}`,
      customClass,
      {
        'is-open': isOpen,
      }
    )

    const activeSubagent =
      subagents.find(s => s.id === (this.state as any).selectedTaskId) ||
      subagents[0]

    return (
      <div className={wrapperClass}>
        <div className="chat-layout">
          {/* 1. Sidebar Session Manager */}
          <div className="chat-sidebar">
            <div className="sidebar-header">
              <span style={{fontWeight: 600, fontSize: 13, color: '#f6f6f8'}}>
                🤖 AI Sessions
              </span>
              <button
                className="new-chat-btn"
                onClick={this.handleCreateNewChat}
              >
                + New Chat
              </button>
            </div>
            <div className="session-list">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className={classnames('session-item', {
                    active: session.id === activeSessionId,
                  })}
                  onClick={() => this.handleSelectSession(session.id)}
                >
                  {session.title}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Main Prompt Chat Thread Container */}
          <div className="chat-thread-container">
            <div className="thread-header">
              <div className="thread-title">
                <span>🤖 {activeSession.title}</span>
              </div>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <Button
                  text={
                    showSubagentPanel
                      ? '🤖 Hide Subagents'
                      : '🤖 Subagent Task Inspector'
                  }
                  color={
                    showSubagentPanel
                      ? ComponentColor.Success
                      : ComponentColor.Default
                  }
                  size={ComponentSize.Small}
                  shape={ButtonShape.Default}
                  onClick={this.handleToggleSubagentPanel}
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

            {/* Message Stream List */}
            <div className="message-list">
              {activeSession.messages.map(msg => (
                <div
                  key={msg.id}
                  className={classnames('message-item', msg.sender)}
                >
                  <div className="message-bubble">
                    {msg.text}
                    {msg.isStreaming && <span className="blinking-cursor" />}
                  </div>

                  {/* Generative Tool Call Card */}
                  {msg.toolCommand &&
                    msg.toolCommand !== 'NONE (BLOCKED BY GATEWAY)' && (
                      <div className="tool-call-card">
                        <div className="tool-header">
                          ⚡ Generative Executed Tool Command
                        </div>
                        <div className="code-block">
                          <code>{msg.toolCommand}</code>
                        </div>
                      </div>
                    )}

                  {/* Security Telemetry Badge */}
                  {msg.action === 'BLOCKED' && (
                    <div className="security-badge blocked">
                      🚨 Security Gateway Intercepted (Dropped in Trash)
                    </div>
                  )}
                  {msg.action === 'REDACTED' && (
                    <div className="security-badge redacted">
                      🔒 Sensitive Secret / PII Data Masked
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Composer Input Footer */}
            <div className="composer-footer">
              <input
                className="chat-input"
                placeholder="Cloudhub AI Ops 장애 분석 및 조치 명령을 입력하세요..."
                value={inputPrompt}
                onChange={this.handleInputChange}
                onKeyDown={this.handleKeyDown}
                disabled={isStreamingActive}
              />
              <Button
                text="전송"
                color={ComponentColor.Success}
                size={ComponentSize.Small}
                shape={ButtonShape.Default}
                onClick={this.handleSendPrompt}
                status={
                  isStreamingActive
                    ? ComponentStatus.Disabled
                    : ComponentStatus.Default
                }
              />
            </div>
          </div>

          {/* 3. 🤖 Codex Style Subagent Task Inspector Panel (React Component Module) */}
          {showSubagentPanel && (
            <div className="subagent-monitor-panel">
              <div className="subagent-header">
                <div className="panel-title">
                  <span>⚡ Subagent Task Inspector</span>
                  <span
                    style={{fontSize: 11, color: '#8e91a1', fontWeight: 400}}
                  >
                    (Codex Real Spec)
                  </span>
                </div>
                <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                  {(['ALL', 'RUNNING', 'SUCCESS', 'ERROR'] as const).map(
                    filter => (
                      <span
                        key={filter}
                        className={classnames('filter-pill', {
                          active: subagentFilter === filter,
                        })}
                        onClick={() => this.handleSetSubagentFilter(filter)}
                        style={{
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {filter} (
                        {
                          subagents.filter(
                            s => filter === 'ALL' || s.status === filter
                          ).length
                        }
                        )
                      </span>
                    )
                  )}
                  <span
                    style={{
                      cursor: 'pointer',
                      fontSize: 14,
                      color: '#8e91a1',
                      marginLeft: 8,
                    }}
                    onClick={this.handleToggleSubagentPanel}
                  >
                    ✕
                  </span>
                </div>
              </div>

              <div style={{flex: 1, display: 'flex', overflow: 'hidden'}}>
                {/* Left Task Menu */}
                <div
                  style={{
                    width: 220,
                    minWidth: 220,
                    backgroundColor: '#14141a',
                    borderRight: '1px solid #292933',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#f0f4f8',
                      paddingBottom: 8,
                      borderBottom: '1px solid #252533',
                      marginBottom: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>Subagent Tasks</span>
                    <span
                      style={{fontSize: 10, color: '#8e91a1', fontWeight: 400}}
                    >
                      ({subagents.length} Active)
                    </span>
                  </div>
                  <div
                    className="subagent-task-list"
                    style={{flex: 1, overflowY: 'auto'}}
                  >
                    {filteredSubagents.map(sub => (
                      <div
                        key={sub.id}
                        className={classnames('subagent-task-card', {
                          active:
                            activeSubagent && activeSubagent.id === sub.id,
                        })}
                        onClick={() =>
                          this.setState({selectedTaskId: sub.id} as any)
                        }
                        style={{
                          padding: '8px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          marginBottom: 4,
                        }}
                      >
                        <div
                          className="card-header"
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 11,
                          }}
                        >
                          <span
                            className="subagent-role"
                            style={{color: '#a0a6b5'}}
                          >
                            {sub.role}
                          </span>
                          <span
                            className={classnames(
                              'status-badge',
                              sub.status.toLowerCase()
                            )}
                            style={{fontSize: 9}}
                          >
                            {sub.progress}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Terminal Execution Logs */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#0a0a0f',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#161620',
                      borderBottom: '1px solid #252533',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#f0f4f8',
                        }}
                      >
                        {activeSubagent
                          ? activeSubagent.role
                          : 'Select Subagent'}
                      </span>
                      <span
                        style={{fontSize: 11, color: '#8a99ad', marginLeft: 8}}
                      >
                        {activeSubagent ? activeSubagent.taskName : ''}
                      </span>
                    </div>
                    {activeSubagent && (
                      <span
                        className={classnames(
                          'status-badge',
                          activeSubagent.status.toLowerCase()
                        )}
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {activeSubagent.status} ({activeSubagent.progress}%)
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: 14,
                      overflowY: 'auto',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: '#d1d5db',
                    }}
                  >
                    <div>
                      [2026-07-30 10:45:01] [System] Subagent{' '}
                      {activeSubagent ? activeSubagent.role : ''} spawned by
                      Main Orchestrator.
                    </div>
                    <div>
                      [2026-07-30 10:45:02] [Action] Executing pipeline task
                      payload...
                    </div>
                    <div style={{color: '#6bdfff'}}>
                      [2026-07-30 10:45:03] [Tool Call] `execute_diagnostics
                      --target="{activeSubagent ? activeSubagent.taskName : ''}
                      "`
                    </div>
                    <div style={{color: '#00e676'}}>
                      [2026-07-30 10:45:04] [Tool Output]{' '}
                      {activeSubagent ? activeSubagent.latestLog : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
}
