import React from 'react'
import {Source} from 'src/types'
import {Page} from 'src/reusable_ui'

interface Props {
  source: Source
}

function OverviewPage({source}: Props) {
  return (
    <Page className="overview-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Overview" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true} />
      </Page.Header>
      <Page.Contents>
        <div>OverviewPage Page</div>
      </Page.Contents>
    </Page>
  )
}

export default OverviewPage
