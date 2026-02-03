import React from 'react'
import {Source} from 'src/types'
import {Page} from 'src/reusable_ui'

interface Props {
  source: Source
}

function AppPerformanceMonitoringPage({source}: Props) {
  return (
    <Page className="app-performance-monitoring-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="App Performance Monitoring" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true} />
      </Page.Header>
      <Page.Contents>
        <div>AppPerformanceMonitoringPage Page</div>
      </Page.Contents>
    </Page>
  )
}

export default AppPerformanceMonitoringPage
