import React from 'react'
import {Source} from 'src/types'
import {Page} from 'src/reusable_ui'

interface Props {
  source: Source
}

function URLMonitoringPage({source}: Props) {
  return (
    <Page className="url-monitoring-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="URL Monitoring" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true} />
      </Page.Header>
      <Page.Contents>
        <div>URL Monitoring Page</div>
      </Page.Contents>
    </Page>
  )
}

export default URLMonitoringPage
