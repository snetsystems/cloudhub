// Libraries
import React, {Component} from 'react'

import {Page} from 'src/reusable_ui'

// table
import RouterTable from 'src/swan_sdplex/components/RouterTable'

// Types
import {Source, Router} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface State {
  routers: Router[]
}

interface Props {
  source: Source
}

@ErrorHandling
class SwanSdplexStatusPage extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
  }
  public componentWillMount() {
    this.setState({
      routers: [
        {
          assetID: 'Router 1',
          routerStatus: 'Running',
          networkStatus: 'Up',
          ApplicationStatus: 'Running',
          cpu: 10,
          memory: 50,
          sdplexTrafficUsage: 10,
          config: 'string',
          firmware: 'string',
        },
        {
          assetID: 'Router 2',
          routerStatus: 'Running',
          networkStatus: 'Up',
          ApplicationStatus: 'Running',
          cpu: 20,
          memory: 20,
          sdplexTrafficUsage: 10,
          config: 'string',
          firmware: 'string',
        },
        {
          assetID: 'Router 3',
          routerStatus: 'Running',
          networkStatus: 'Up',
          ApplicationStatus: 'Running',
          cpu: 30,
          memory: 30,
          sdplexTrafficUsage: 10,
          config: 'string',
          firmware: 'string',
        },
        {
          assetID: 'Router 4',
          routerStatus: 'Running',
          networkStatus: 'Up',
          ApplicationStatus: 'Running',
          cpu: 40,
          memory: 20,
          sdplexTrafficUsage: 10,
          config: 'string',
          firmware: 'string',
        },
        {
          assetID: 'Router 5',
          routerStatus: 'Running',
          networkStatus: 'Up',
          ApplicationStatus: 'Running',
          cpu: 20,
          memory: 10,
          sdplexTrafficUsage: 10,
          config: 'string',
          firmware: 'string',
        },
      ],
    })
  }
  public render() {
    const {routers} = this.state

    return (
      <Page className="hosts-list-page">
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="SWAN/SDPlex - Status" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true} />
        </Page.Header>
        <Page.Contents fullWidth={true} scrollable={true}>
          <div className="dashboard container-fluid full-width">
            <RouterTable routers={routers} />
          </div>
        </Page.Contents>
      </Page>
    )
  }
}

export default SwanSdplexStatusPage
