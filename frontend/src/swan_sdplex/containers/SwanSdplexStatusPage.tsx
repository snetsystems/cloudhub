// Libraries
import React, {Component} from 'react'

import {Page} from 'src/reusable_ui'

// table
import RouterTable from 'src/swan_sdplex/components/RouterTable'

// Types
import {Source, Router} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

import RouterModal from 'src/swan_sdplex/components/RouterModal'

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
          config: '/etc/sdplex/configuration',
          firmware: '/etc/sdplex/configuration',
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
        {
          assetID: 'Router 1',
          routerStatus: 'Running',
          networkStatus: 'Up',
          ApplicationStatus: 'Running',
          cpu: 10,
          memory: 50,
          sdplexTrafficUsage: 10,
          config: '/etc/sdplex/configuration',
          firmware: '/etc/sdplex/configuration',
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
        {
          assetID: 'Router 1',
          routerStatus: 'Running',
          networkStatus: 'Up',
          ApplicationStatus: 'Running',
          cpu: 10,
          memory: 50,
          sdplexTrafficUsage: 10,
          config: '/etc/sdplex/configuration',
          firmware: '/etc/sdplex/configuration',
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

  public onClickModalCall({name, _this, onClickfn}) {
    return (
      <RouterModal name={name} targetObject={_this} onClickfn={onClickfn} />
    )
  }

  public render() {
    const {routers} = this.state

    return (
      <Page className="hosts-list-page">
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="128T/SDPlex - Status" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true} />
        </Page.Header>
        <Page.Contents fullWidth={true} scrollable={true}>
          <div className="dashboard container-fluid full-width">
            <RouterTable
              routers={routers}
              onClickModal={this.onClickModalCall}
            />
          </div>
        </Page.Contents>
      </Page>
    )
  }
}

export default SwanSdplexStatusPage
