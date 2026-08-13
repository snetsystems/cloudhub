import React, {FC} from 'react'
import {Page} from 'src/reusable_ui'
import CloudhubAiChatStandalone from 'src/reusable_ui/components/cloudhub_ai_chat/CloudhubAiChatStandalone'
import {CustomPanelView} from 'src/reusable_ui/components/cloudhub_ai_chat/SubagentInspectorPanel'

export const AiChatTestPage: FC = () => {
  // Example custom views that can be rendered alongside or in place of Subagent Inspector
  const sampleCustomPanelViews: CustomPanelView[] = [
    {
      id: 'resource-monitor',
      label: 'Cluster Metrics',
      component: (
        <div style={{padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px'}}>
          <h4 style={{color: '#63b3ed', margin: 0}}>CloudHub Infrastructure Monitor</h4>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
            <div style={{background: '#1a202c', padding: '12px', borderRadius: '8px', border: '1px solid #2d3748'}}>
              <div style={{fontSize: '11px', color: '#a0aec0'}}>CPU USAGE</div>
              <div style={{fontSize: '20px', fontWeight: 'bold', color: '#68d391'}}>34.2%</div>
            </div>
            <div style={{background: '#1a202c', padding: '12px', borderRadius: '8px', border: '1px solid #2d3748'}}>
              <div style={{fontSize: '11px', color: '#a0aec0'}}>MEMORY USAGE</div>
              <div style={{fontSize: '20px', fontWeight: 'bold', color: '#f6ad55'}}>6.4 / 16 GB</div>
            </div>
          </div>
          <div style={{background: '#1a202c', padding: '12px', borderRadius: '8px', border: '1px solid #2d3748'}}>
            <div style={{fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#e2e8f0'}}>Active Pod Status</div>
            <ul style={{margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#cbd5e0'}}>
              <li>openclaw-gateway-v2: <span style={{color: '#68d391'}}>Healthy</span></li>
              <li>subagent-runner-pool: <span style={{color: '#68d391'}}>Healthy (3 Workers)</span></li>
              <li>influxdb-telemetry: <span style={{color: '#68d391'}}>Healthy</span></li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'security-audit',
      label: 'Security Scanner',
      component: (
        <div style={{padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
          <h4 style={{color: '#f6ad55', margin: 0}}>Real-time Security Interceptor</h4>
          <div style={{fontSize: '12px', color: '#cbd5e0', background: '#1a202c', padding: '12px', borderRadius: '8px', border: '1px solid #2d3748'}}>
            OpenClaw Gateway Interceptor Active<br />
            Secret Masking Level: High (PII & API Keys Redacted)<br />
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
          <Page.Title title="CloudHub AI Ops Chat & Subagent Inspector" />
        </Page.Header.Left>
        <Page.Header.Right />
      </Page.Header>
      <Page.Contents fullWidth={true} scrollable={false}>
        <div style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column'}}>
          <CloudhubAiChatStandalone
            mode="full"
            isOpen={true}
            customPanelViews={sampleCustomPanelViews}
          />
        </div>
      </Page.Contents>
    </Page>
  )
}

export default AiChatTestPage
