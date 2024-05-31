// Libraries
import React, {PureComponent} from 'react'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {}

@ErrorHandling
export default class DeviceManagementCompletionStep extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    return (
      <div className="wizard-step--bookend">
        <div className="auth-logo" />
        <p>You have successfully configured your Device Connection</p>
      </div>
    )
  }
}
