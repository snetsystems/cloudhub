import React, {PureComponent} from 'react'
import _ from 'lodash'

import Container from 'src/reusable_ui/components/overlays/OverlayContainer'
import Heading from 'src/reusable_ui/components/overlays/OverlayHeading'
import Body from 'src/reusable_ui/components/overlays/OverlayBody'
import DragAndDrop from 'src/shared/components/DragAndDrop'
import {
  notifyTopologyImported,
  notifyTopologyImportFailed,
} from 'src/shared/copy/notifications'

import {Notification} from 'src/types/notifications'
import {getParseHTML} from '../utils/topology'

interface Props {
  onDismissOverlay: () => void
  notify: (message: Notification) => void
  onImportTopology: (topology: string) => void
}

class ImportTopologyOverlay extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {onDismissOverlay} = this.props
    const title = 'Import Topology'

    return (
      <Container maxWidth={800}>
        <Heading title={title} onDismiss={onDismissOverlay} />
        <Body>{this.renderDragAndDrop}</Body>
      </Container>
    )
  }

  private get renderDragAndDrop(): JSX.Element {
    return (
      <DragAndDrop
        submitText="Continue"
        fileTypesToAccept={this.validFileExtension}
        handleSubmit={this.handleContinueImport}
      />
    )
  }

  private get validFileExtension(): string {
    return '.xml'
  }

  private checkInvalidXML(uploadContent: string): boolean {
    const xmlString = getParseHTML(uploadContent, 'application/xml')
    const errorNode = xmlString.querySelector('parsererror')

    if (errorNode) {
      return true
    }

    return false
  }

  private handleContinueImport = (
    uploadContent: string,
    fileName: string
  ): void => {
    const {notify, onImportTopology, onDismissOverlay} = this.props
    const fileExtensionRegex = new RegExp(`${this.validFileExtension}$`)

    if (!fileName.match(fileExtensionRegex)) {
      notify(notifyTopologyImportFailed(fileName, 'Please import a XML file'))
      return
    }

    if (this.checkInvalidXML(uploadContent)) {
      notify(notifyTopologyImportFailed(fileName, 'Invalid XML File'))
      return
    }

    try {
      onImportTopology(uploadContent)
      onDismissOverlay()
      notify(notifyTopologyImported(fileName))
    } catch (error) {
      notify(notifyTopologyImportFailed(fileName, error))
    }
  }
}

export default ImportTopologyOverlay
