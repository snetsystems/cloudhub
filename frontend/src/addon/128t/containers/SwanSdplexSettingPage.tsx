// Libraries
import React, {PureComponent} from 'react'

// Components

import {Page} from 'src/reusable_ui'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface State {}

interface Props {}

@ErrorHandling
class SwanSdplexSettingPage extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    return (
      <Page>
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="SWAN/Oncue - Setting" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true} />
        </Page.Header>
        <Page.Contents fullWidth={true}>
          <div className="dashboard container-fluid full-width"></div>
        </Page.Contents>
      </Page>
    )
  }
}

export default SwanSdplexSettingPage
