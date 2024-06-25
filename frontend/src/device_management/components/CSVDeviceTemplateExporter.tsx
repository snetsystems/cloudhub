import React, {PureComponent} from 'react'

import {Button, IconFont, ComponentStatus} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  title: string
  onDownloadCSVDeviceTemplate: () => void
}

interface State {
  buttonStatus: ComponentStatus
}

@ErrorHandling
export default class CSVDeviceTemplateExporter extends PureComponent<
  Props,
  State
> {
  constructor(props) {
    super(props)

    this.state = {buttonStatus: ComponentStatus.Default}
  }

  public render() {
    const {title} = this.props
    const {buttonStatus} = this.state

    return (
      <Button
        customClass="csv-export"
        text={title}
        icon={IconFont.Download}
        status={buttonStatus}
        onClick={this.handleClick}
      />
    )
  }

  private handleClick = async (): Promise<void> => {
    const {onDownloadCSVDeviceTemplate} = this.props

    onDownloadCSVDeviceTemplate()
  }
}
