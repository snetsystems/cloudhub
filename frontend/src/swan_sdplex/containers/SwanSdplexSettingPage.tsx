// Libraries
import React, {Component} from 'react'

// Components

import {Page} from 'src/reusable_ui'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface State {}

interface Props {}

@ErrorHandling
class SwanSdplexSettingPage extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    return (
      <Page>
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="128T/SDPlex - Setting" />
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
