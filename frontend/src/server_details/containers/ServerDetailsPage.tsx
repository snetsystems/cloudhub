import React, {useState} from 'react'
import {Source} from 'src/types'
import {Button, ComponentColor, Page} from 'src/reusable_ui'
import FixedModal from 'src/reusable_ui/components/FixedModal/FixedModal'

interface Props {
  source: Source
}

function ServerDetailsPage({source}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const ModalContents = () => {
    return (
      <div>
        <h1>Import Dashboard</h1>
      </div>
    )
  }

  return (
    <Page className="server-details-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Server Details" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true}>
          <Button
            text="Import Modal"
            color={ComponentColor.Primary}
            onClick={() => {
              setIsModalOpen(prev => !prev)
            }}
          />
        </Page.Header.Right>
      </Page.Header>
      <Page.Contents>
        <FixedModal isOpen={isModalOpen} setIsOpen={setIsModalOpen}>
          <ModalContents />
        </FixedModal>
      </Page.Contents>
    </Page>
  )
}

export default ServerDetailsPage
