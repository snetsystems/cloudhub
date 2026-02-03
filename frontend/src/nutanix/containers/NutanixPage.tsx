import React from 'react'
import {Source} from 'src/types'
import {Page} from 'src/reusable_ui'

interface Props {
  source: Source
}

function NutanixPage({source}: Props) {
  return (
    <Page className="nutanix-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Nutanix" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true} />
      </Page.Header>
      <Page.Contents>
        <div>NutanixPage Page</div>
      </Page.Contents>
    </Page>
  )
}

export default NutanixPage
