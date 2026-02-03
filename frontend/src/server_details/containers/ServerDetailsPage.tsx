import React from 'react'
import {Source} from 'src/types'
import {Page} from 'src/reusable_ui'

interface Props {
  source: Source
}

function ServerDetailsPage({source}: Props) {
  return (
    <Page className="server-details-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Server Details" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true} />
      </Page.Header>
      <Page.Contents>
        <div>ServerDetailsPage Page</div>
      </Page.Contents>
    </Page>
  )
}

export default ServerDetailsPage
