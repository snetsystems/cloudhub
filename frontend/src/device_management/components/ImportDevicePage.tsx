import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import DragAndDrop from 'src/shared/components/DragAndDrop'
import {
  Button,
  ComponentColor,
  ComponentStatus,
  Form,
  OverlayBody,
  OverlayContainer,
  OverlayHeading,
  OverlayTechnology,
} from 'src/reusable_ui'
import CSVDeviceTemplateExporter from 'src/device_management/components/CSVDeviceTemplateExporter'

// Types
import {ImportDevicePageStatus} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  deviceDataRawFromCSV: string
  importDevicePageStatus: ImportDevicePageStatus
  isVisible: boolean
  onDismissOverlay: () => void
  onDownloadCSVDeviceTemplate: () => void
  onGoBackImportedDeviceFile: () => void
  onGoNextImportedDeviceFile: () => void
  onSaveImportedDeviceFile: () => void
  onUploadImportedDeviceFile: (uploadContent: string, fileName: string) => void
}

@ErrorHandling
class ImportDevicePage extends PureComponent<Props> {
  public constructor(props: Props) {
    super(props)
  }

  public render() {
    const {importDevicePageStatus, isVisible} = this.props

    return (
      <>
        <OverlayTechnology visible={isVisible}>
          <OverlayContainer maxWidth={800}>
            {importDevicePageStatus === 'UploadCSV' && this.UploadCSV}
            {importDevicePageStatus === 'DeviceStatus' && this.deviceStatus}
          </OverlayContainer>
        </OverlayTechnology>
      </>
    )
  }

  private get validFileExtension(): string {
    return '.csv'
  }

  private get UploadCSV(): JSX.Element {
    const {
      deviceDataRawFromCSV,
      onDismissOverlay,
      onGoNextImportedDeviceFile,
      onUploadImportedDeviceFile,
    } = this.props

    return (
      <>
        <OverlayHeading
          title={'Import Device File'}
          onDismiss={onDismissOverlay}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <>
                <div className="form-group col-xs-12">
                  <label>Upload a CSV File</label>
                  {this.csvDeviceTemplateExporter}
                  <DragAndDrop
                    submitText="Preview"
                    fileTypesToAccept={this.validFileExtension}
                    handleSubmit={onUploadImportedDeviceFile}
                    submitOnDrop={true}
                    submitOnUpload={true}
                    compact={true}
                  />
                </div>
              </>
            </Form.Element>
            <Form.Footer>
              <Button
                status={
                  deviceDataRawFromCSV === ''
                    ? ComponentStatus.Disabled
                    : ComponentStatus.Default
                }
                text="Next"
                color={ComponentColor.Primary}
                onClick={onGoNextImportedDeviceFile}
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </>
    )
  }

  private get csvDeviceTemplateExporter(): JSX.Element {
    const {onDownloadCSVDeviceTemplate} = this.props

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingBottom: '1%',
        }}
      >
        <CSVDeviceTemplateExporter
          onDownloadCSVDeviceTemplate={onDownloadCSVDeviceTemplate}
        />
      </div>
    )
  }

  private get deviceStatus(): JSX.Element {
    const {
      onDismissOverlay,
      onGoBackImportedDeviceFile,
      onSaveImportedDeviceFile,
    } = this.props

    return (
      <>
        <OverlayHeading
          title={'Import Device File'}
          onDismiss={onDismissOverlay}
        />
        <OverlayBody>
          <Form>
            <Form.Element>
              <></>
            </Form.Element>
            <Form.Footer>
              <Button
                text="Go Back"
                color={ComponentColor.Default}
                onClick={onGoBackImportedDeviceFile}
              />
              <Button
                text="Save"
                color={ComponentColor.Success}
                onClick={onSaveImportedDeviceFile}
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </>
    )
  }
}

export default ImportDevicePage
