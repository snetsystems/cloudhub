import React from 'react'
import {Source} from 'src/types'
import {Page} from 'src/reusable_ui'

interface Props {
  source: Source
}

function DBMonitoringPage({source}: Props) {
  return (
    <Page className="db-monitoring-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="DB Monitoring" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true} />
      </Page.Header>
      <Page.Contents>
        <div>DBMonitoringPage Page</div>
      </Page.Contents>
    </Page>
  )
}

export default DBMonitoringPage
