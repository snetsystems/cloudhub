import React, {FC, useState, useEffect} from 'react'
import classnames from 'classnames'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import RadioButtons from 'src/reusable_ui/components/radio_buttons/RadioButtons'
import {
  SubagentTask,
  ActivityCardItem,
} from 'src/ai_chat/containers/CloudhubAiChatStandalone'
import AiChatBadge from 'src/ai_chat/components/AiChatBadge'
import AiChatMessageMarkdown from 'src/ai_chat/components/AiChatMessageMarkdown'
import MessageActivityInspector, {
  ConversationTurnItem,
} from 'src/ai_chat/components/MessageActivityInspector'

export interface CustomPanelView {
  id: string
  label: string
  icon?: string
  component: React.ReactNode
}

export interface SubagentInspectorPanelProps {
  subagents: SubagentTask[]
  activeTaskId: string | null
  onSelectTaskId: (id: string) => void
  subagentFilter: 'ALL' | 'RUNNING' | 'SUCCESS' | 'ERROR'
  onSetSubagentFilter: (filter: 'ALL' | 'RUNNING' | 'SUCCESS' | 'ERROR') => void
  onClosePanel: () => void
  defaultViewMode?: 'terminal' | 'character'
  customViews?: CustomPanelView[]
  activeInspectorTab?: string
  onChangeInspectorTab?: (tab: string) => void
  turns?: ConversationTurnItem[]
  selectedTurnId?: string | null
  onSelectTurnId?: (id: string) => void
}

export const SubagentInspectorPanel: FC<SubagentInspectorPanelProps> = ({
  subagents,
  activeTaskId,
  onSelectTaskId,
  subagentFilter,
  onSetSubagentFilter,
  onClosePanel,
  defaultViewMode = 'character',
  customViews = [],
  activeInspectorTab = 'activity',
  onChangeInspectorTab,
  turns = [],
  selectedTurnId,
  onSelectTurnId,
}) => {
  const [internalTab, setInternalTab] = useState<string>(activeInspectorTab)
  const [inspectorViewMode, setInspectorViewMode] = useState<'terminal' | 'character'>(defaultViewMode)

  useEffect(() => {
    if (activeInspectorTab) {
      setInternalTab(activeInspectorTab)
    }
  }, [activeInspectorTab])

  const handleTabChange = (tab: string) => {
    setInternalTab(tab)
    if (onChangeInspectorTab) {
      onChangeInspectorTab(tab)
    }
  }

  const activeTab = internalTab

  const activeSubagent =
    subagents.find(s => s.id === activeTaskId) || (subagents.length > 0 ? subagents[0] : null)

  const filteredSubagents = subagents.filter(sub => {
    if (subagentFilter === 'ALL') return true
    return sub.status === subagentFilter
  })

  // Render Storyboard Character View
  const renderCharacterStage = (sub: SubagentTask) => {
    let stateMessage = ''
    let stageStatusClass = sub.status.toLowerCase()

    if (sub.status === 'RUNNING') {
      if (sub.progress < 40) {
        stateMessage = `Main Agent로부터 '${sub.taskName}' 태스크 패킷 수신 중...`
      } else if (sub.progress < 85) {
        stateMessage = `Subagent 픽셀 워커가 샌드박스에서 작업을 수행 중입니다!`
      } else {
        stateMessage = `작업 검증을 마치고 Main Agent에게 결과 보고서를 전송하는 중...`
      }
    } else if (sub.status === 'SUCCESS') {
      stateMessage = `작업 성공! Main Agent에게 결과 전달이 완료되었습니다.`
    } else if (sub.status === 'ERROR') {
      stateMessage = `작업 중 예외 발생! Main Agent에게 비상 오류 리포트를 송출합니다.`
    } else {
      stateMessage = `Main Agent의 새로운 태스크 할당 명령을 기다리는 중...`
    }

    return (
      <div className="subagent-character-stage">
        {/* Pixel Art Interactive Storyboard Canvas Stage */}
        <div className={classnames('pixel-storyboard-stage', stageStatusClass)}>
          {/* Main Orchestrator (Boss Agent) */}
          <div className="agent-entity main-orchestrator">
            <div className="agent-label">Main Agent</div>
            <div className="pixel-sprite boss-sprite">
              <svg viewBox="0 0 32 32" className="pixel-svg">
                <rect x="8" y="4" width="16" height="14" fill="#6B46C1" rx="2" />
                <rect x="11" y="7" width="10" height="7" fill="#1A202C" />
                <rect x="13" y="9" width="2" height="2" fill="#00F5D4" className="pixel-eye" />
                <rect x="17" y="9" width="2" height="2" fill="#00F5D4" className="pixel-eye" />
                <rect x="6" y="18" width="20" height="10" fill="#4A5568" rx="2" />
                <rect x="14" y="19" width="4" height="8" fill="#718096" />
              </svg>
            </div>
            <AiChatBadge variant="category" size="sm">
              Orchestrator
            </AiChatBadge>
          </div>

          {/* Dynamic Interactive Story Connection Track */}
          <div className="pixel-track">
            {sub.status === 'RUNNING' && sub.progress < 50 && (
              <div className="data-packet dispatching">
                <span className="packet-dot" />
                <span className="packet-label">Task</span>
              </div>
            )}

            {sub.status === 'RUNNING' && sub.progress >= 50 && (
              <div className="data-packet reporting">
                <span className="packet-dot" />
                <span className="packet-label">Report</span>
              </div>
            )}

            {sub.status === 'SUCCESS' && (
              <div className="connection-line success-line" />
            )}

            {sub.status === 'ERROR' && (
              <div className="connection-line error-line" />
            )}
          </div>

          {/* Subagent Worker Entity */}
          <div className={classnames('agent-entity sub-worker', stageStatusClass)}>
            <div className="agent-label" title={sub.role}>{sub.role}</div>
            <div className="pixel-sprite worker-sprite">
              <svg viewBox="0 0 32 32" className="pixel-svg">
                <rect x="8" y="4" width="16" height="14" fill={sub.status === 'SUCCESS' ? '#38A169' : sub.status === 'ERROR' ? '#E53E3E' : '#3182CE'} rx="3" />
                <rect x="11" y="7" width="10" height="7" fill="#0F172A" />
                <rect x="13" y="9" width="2" height="2" fill="#F6AD55" className="pixel-eye anim-blink" />
                <rect x="17" y="9" width="2" height="2" fill="#F6AD55" className="pixel-eye anim-blink" />
                <rect x="8" y="18" width="16" height="10" fill="#2D3748" rx="2" />
                {sub.status === 'RUNNING' && (
                  <circle cx="26" cy="22" r="3" className="pixel-gear-spin" fill="#63B3ED" />
                )}
              </svg>
            </div>
            <AiChatBadge variant={sub.status.toLowerCase()} size="sm">
              {sub.status}
            </AiChatBadge>
          </div>
        </div>

        {/* Live Story Narrative Banner */}
        <div className="story-narrative-card">
          <div className="narrative-header">
            <span className="narrative-title">Story Narrative Track</span>
            <AiChatBadge variant={sub.status.toLowerCase()} size="sm">
              {sub.progress}%
            </AiChatBadge>
          </div>
          <div className="narrative-text">{stateMessage}</div>
          <div className="story-progress-bar">
            <div className="story-progress-fill" style={{ width: `${sub.progress}%` }} />
          </div>
        </div>

        {/* Interactive Workflow Progress */}
        <div className="step-workflow-card">
          <div className="card-section-title">Interactive Workflow Progress</div>
          <div className="step-nodes-container">
            {(sub.steps || [
              { title: '작업 할당', status: 'done' },
              { title: '실행 진행 중', status: sub.status === 'RUNNING' ? 'active' : sub.status === 'SUCCESS' ? 'done' : 'error' },
              { title: '검증 & 완료', status: sub.status === 'SUCCESS' ? 'done' : 'pending' }
            ]).map((step, idx) => (
              <div key={idx} className={classnames('step-node', step.status)}>
                <div className="node-icon">
                  {step.status === 'done' && '✓'}
                  {step.status === 'active' && <span className="active-spinner" />}
                  {step.status === 'error' && '✕'}
                  {step.status === 'pending' && (idx + 1)}
                </div>
                <div className="node-title">{step.title}</div>
                {idx < (sub.steps?.length || 3) - 1 && <div className="node-line" />}
              </div>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <div className="human-logs-card">
          <div className="card-section-title">Human Readable Activity Log</div>
          <div className="human-log-list">
            <div className="log-item">
              <span className="log-time">10:45:01</span>
              <div className="log-desc">
                <AiChatMessageMarkdown content={`Main Orchestrator가 **${sub.role}**에게 태스크 발주`} />
              </div>
            </div>
            <div className="log-item">
              <span className="log-time">10:45:03</span>
              <div className="log-desc">
                <AiChatMessageMarkdown content={`\`${sub.taskName}\` 수행 시작`} />
              </div>
            </div>
            <div className="log-item highlight">
              <span className="log-time">10:45:05</span>
              <div className="log-desc">
                <AiChatMessageMarkdown content={sub.latestLog || ''} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Active custom panel (if tab is switched)
  const currentCustomView = customViews.find(v => v.id === activeTab)

  return (
    <div className="subagent-monitor-panel">
      {/* Panel Top Navigation Bar: Switch between Tool Activity, Subagent Inspector, and Custom Views */}
      <div className="panel-tab-nav">
        <button
          className={classnames('tab-nav-item', {
            active: activeTab === 'activity',
          })}
          onClick={() => handleTabChange('activity')}
          type="button"
        >
          도구 실행 내역
          {turns.length > 0 && (
            <span className="tab-count-pill">{turns.length}</span>
          )}
        </button>

        <button
          className={classnames('tab-nav-item', {
            active: activeTab === 'subagent-inspector',
          })}
          onClick={() => handleTabChange('subagent-inspector')}
          type="button"
        >
          SubAgent Tasks
          {subagents.length > 0 && (
            <span className="tab-count-pill">{subagents.length}</span>
          )}
        </button>

        {customViews.map(view => (
          <button
            key={view.id}
            className={classnames('tab-nav-item', {
              active: activeTab === view.id,
            })}
            onClick={() => handleTabChange(view.id)}
            type="button"
          >
            {view.icon ? `${view.icon} ` : ''}{view.label}
          </button>
        ))}
      </div>

      {activeTab === 'activity' ? (
        <MessageActivityInspector
          turns={turns}
          selectedTurnId={selectedTurnId}
          onSelectTurnId={onSelectTurnId}
          onClose={onClosePanel}
        />
      ) : activeTab === 'subagent-inspector' ? (
        <>
          <div className="subagent-header">
            <div className="panel-title">
              <div className="radio-buttons radio-buttons--default radio-buttons--sm">
                <RadioButtons.Button
                  id="view-character"
                  active={inspectorViewMode === 'character'}
                  value="character"
                  onClick={() => setInspectorViewMode('character')}
                  titleText="Character View"
                >
                  Character View
                </RadioButtons.Button>
                <RadioButtons.Button
                  id="view-terminal"
                  active={inspectorViewMode === 'terminal'}
                  value="terminal"
                  onClick={() => setInspectorViewMode('terminal')}
                  titleText="Terminal View"
                >
                  Terminal View
                </RadioButtons.Button>
              </div>
            </div>
            <div className="filter-pill-container">
              <div className="radio-buttons radio-buttons--default radio-buttons--sm">
                {[
                  { key: 'ALL', label: 'All' },
                  { key: 'RUNNING', label: 'Running' },
                  { key: 'SUCCESS', label: 'Success' },
                  { key: 'ERROR', label: 'Error' },
                ].map(f => (
                  <RadioButtons.Button
                    key={f.key}
                    id={`filter-${f.key}`}
                    active={subagentFilter === f.key}
                    value={f.key}
                    onClick={() => onSetSubagentFilter(f.key as any)}
                    titleText={`${f.label} Filter`}
                  >
                    {`${f.label} (${subagents.filter(s => f.key === 'ALL' || s.status === f.key).length})`}
                  </RadioButtons.Button>
                ))}
              </div>
              <span
                className="close-panel-btn"
                onClick={onClosePanel}
                title="Close Inspector Panel"
              >
                ✕
              </span>
            </div>
          </div>

          <div className="inspector-body">
            <div className="task-menu-sidebar">
              <div className="task-menu-header">
                <span>Subagent Tasks</span>
                <AiChatBadge variant="category" size="sm">
                  {subagents.length} Active
                </AiChatBadge>
              </div>
              <div className="subagent-task-list-wrapper">
                <FancyScrollbar autoHide={true}>
                  <div className="subagent-task-list">
                    {filteredSubagents.map(sub => (
                      <div
                        key={sub.id}
                        className={classnames('subagent-task-card', {
                          active: activeSubagent && activeSubagent.id === sub.id,
                        })}
                        onClick={() => onSelectTaskId(sub.id)}
                      >
                        <div className="card-header">
                          <span className="subagent-role" title={sub.role}>
                            {sub.role}
                          </span>
                          <AiChatBadge
                            variant={sub.status.toLowerCase()}
                            size="sm"
                          >
                            {sub.progress}%
                          </AiChatBadge>
                        </div>
                        <div className="subagent-task-name" title={sub.taskName}>
                          {sub.taskName}
                        </div>
                      </div>
                    ))}
                  </div>
                </FancyScrollbar>
              </div>
            </div>

            {inspectorViewMode === 'character' ? (
              <div className="character-view-wrapper">
                <FancyScrollbar autoHide={true}>
                  {activeSubagent ? renderCharacterStage(activeSubagent) : (
                    <div className="no-subagent">선택된 서브에이전트가 없습니다.</div>
                  )}
                </FancyScrollbar>
              </div>
            ) : (
              <div className="terminal-logs-view">
                <div className="terminal-header">
                  <div>
                    <span className="active-subagent-role">
                      {activeSubagent ? activeSubagent.role : 'Select Subagent'}
                    </span>
                    <span className="active-task-name">
                      {activeSubagent ? ` - ${activeSubagent.taskName}` : ''}
                    </span>
                  </div>
                  {activeSubagent && (
                    <AiChatBadge
                      variant={activeSubagent.status.toLowerCase()}
                      size="sm"
                    >
                      {activeSubagent.status} ({activeSubagent.progress}%)
                    </AiChatBadge>
                  )}
                </div>
                <div className="terminal-console-wrapper">
                  <FancyScrollbar autoHide={true}>
                    <div className="terminal-console-output">
                      <div className="log-line-system">
                        <AiChatMessageMarkdown
                          content={`[System] Subagent **${activeSubagent ? activeSubagent.role : ''}** spawned by Main Orchestrator.`}
                        />
                      </div>
                      <div className="log-line-action">
                        <AiChatMessageMarkdown
                          content="[Action] Executing pipeline task payload..."
                        />
                      </div>
                      <div className="log-line-tool">
                        <AiChatMessageMarkdown
                          content={`[Tool Call] \`execute_diagnostics --target="${activeSubagent ? activeSubagent.taskName : ''}"\``}
                        />
                      </div>
                      <div className="log-line-output">
                        <AiChatMessageMarkdown
                          content={`[Tool Output] ${activeSubagent ? activeSubagent.latestLog : ''}`}
                        />
                      </div>
                    </div>
                  </FancyScrollbar>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Render Custom Component registered by user */
        <div className="custom-panel-container">
          <div className="custom-panel-header">
            <span className="custom-panel-title">{currentCustomView?.label}</span>
            <span className="close-panel-btn" onClick={onClosePanel}>✕</span>
          </div>
          <div className="custom-panel-body">
            <FancyScrollbar autoHide={true}>
              {currentCustomView?.component || <div>No component provided.</div>}
            </FancyScrollbar>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubagentInspectorPanel
