import React, {FC} from 'react'
import {connect} from 'react-redux'
import {Page} from 'src/reusable_ui'
import CloudhubAiChatStandalone from 'src/reusable_ui/components/cloudhub_ai_chat/CloudhubAiChatStandalone'
import {CustomPanelView} from 'src/reusable_ui/components/cloudhub_ai_chat/SubagentInspectorPanel'
import AiChatBadge from 'src/reusable_ui/components/cloudhub_ai_chat/AiChatBadge'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import {setTimeZone} from 'src/shared/actions/app'
import {TimeZones} from 'src/types'

interface StateProps {
  timeZone: TimeZones
}

interface DispatchProps {
  onSetTimeZone: typeof setTimeZone
}

type Props = StateProps & DispatchProps

export const AiChatPage: FC<Props> = ({timeZone, onSetTimeZone}) => {
  // Custom views rendered alongside Subagent Inspector
  const customPanelViews: CustomPanelView[] = [
    {
      id: 'resource-monitor',
      label: 'Cluster Metrics',
      component: (
        <div className="ai-chat-custom-panel-metrics">
          <h4 className="ai-chat-custom-panel-title">
            CloudHub Infrastructure Monitor
          </h4>
          <div className="ai-chat-metrics-grid">
            <div className="ai-chat-metric-card">
              <div className="ai-chat-metric-label">CPU USAGE</div>
              <div className="ai-chat-metric-value-cpu">34.2%</div>
            </div>
            <div className="ai-chat-metric-card">
              <div className="ai-chat-metric-label">MEMORY USAGE</div>
              <div className="ai-chat-metric-value-mem">6.4 / 16 GB</div>
            </div>
          </div>
          <div className="ai-chat-pod-status-card">
            <div className="ai-chat-pod-status-title">Active Pod Status</div>
            <ul className="ai-chat-pod-status-list">
              <li>
                openclaw-gateway-v2:{' '}
                <AiChatBadge variant="success" size="sm">
                  Healthy
                </AiChatBadge>
              </li>
              <li>
                subagent-runner-pool:{' '}
                <AiChatBadge variant="success" size="sm">
                  Healthy (3 Workers)
                </AiChatBadge>
              </li>
              <li>
                influxdb-telemetry:{' '}
                <AiChatBadge variant="success" size="sm">
                  Healthy
                </AiChatBadge>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'security-audit',
      label: 'Security Scanner',
      component: (
        <div className="ai-chat-security-audit-panel">
          <h4 className="ai-chat-security-audit-title">
            Real-time Security Interceptor
          </h4>
          <div className="ai-chat-security-audit-card">
            OpenClaw Gateway Interceptor Active
            <br />
            Secret Masking Level: High (PII & API Keys Redacted)
            <br />
            Subagent Sandbox Isolation: Enforced
          </div>
        </div>
      ),
    },
  ]

  return (
    <Page>
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="CloudHub AI Ops Assistant" />
        </Page.Header.Left>
        <Page.Header.Right>
          <TimeZoneToggle
            timeZone={timeZone}
            onSetTimeZone={onSetTimeZone}
          />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true} scrollable={false}>
        <div className="ai-chat-page-container">
          <CloudhubAiChatStandalone
            mode="full"
            isOpen={true}
            customPanelViews={customPanelViews}
            timeZone={timeZone}
          />
        </div>
      </Page.Contents>
    </Page>
  )
}

const mstp = (state: {app?: {persisted?: {timeZone?: TimeZones}}}): StateProps => ({
  timeZone: state.app?.persisted?.timeZone ?? TimeZones.Local,
})

const mdtp: DispatchProps = {
  onSetTimeZone: setTimeZone,
}

export default connect(mstp, mdtp)(AiChatPage)
