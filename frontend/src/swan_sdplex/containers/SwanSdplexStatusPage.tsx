// Libraries
import React, {Component} from 'react'

import {Page} from 'src/reusable_ui'

// Types
import {Source, Router, TopSources} from 'src/types'

import {ErrorHandling} from 'src/shared/decorators/errors'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import RouterModal from 'src/swan_sdplex/components/RouterModal'
// table
import RouterTable from 'src/swan_sdplex/components/RouterTable'
import TopSourcesTable from 'src/swan_sdplex/components/TopSourcesTable'

//const
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

interface State {
  routers: Router[]
  topSources: TopSources[]
  proportions: number[]
}

interface Props {
  source: Source
}

@ErrorHandling
class SwanSdplexStatusPage extends Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      routers: [],
      topSources: [],
      proportions: [0.65, 0.35],
    }
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
      topSources: [
        {
          ip: '169.254.127.127',
          tenant: '_internal_',
          currentBandwidth: 3706,
          totalData: 1251214,
          sessionCount: 96,
        },
        {
          ip: '198.199.90.187',
          tenant: '<global>',
          currentBandwidth: 0,
          totalData: 166,
          sessionCount: 1,
        },
        {
          ip: '172.16.0.2',
          tenant: 'tenant-SDPLEX',
          currentBandwidth: 59,
          totalData: 85006,
          sessionCount: 910,
        },
        {
          ip: '63.240.240.74',
          tenant: '<global>',
          currentBandwidth: 0,
          totalData: 37474,
          sessionCount: 9,
        },
        {
          ip: '115.159.44.32',
          tenant: '<global>',
          currentBandwidth: 0,
          totalData: 35308,
          sessionCount: 9,
        },
        {
          ip: '176.31.182.125',
          tenant: '<global>',
          currentBandwidth: 0,
          totalData: 34642,
          sessionCount: 9,
        },
        {
          ip: '51.158.189.0',
          tenant: '<global>',
          currentBandwidth: 0,
          totalData: 33750,
          sessionCount: 9,
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
    return (
      <Page className="hosts-list-page">
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="128T/SDPlex - Status" />
          </Page.Header.Left>
          <Page.Header.Right showSourceIndicator={true} />
        </Page.Header>
        {/* <Page.Contents fullWidth={true} scrollable={true}>
          <div className="dashboard container-fluid full-width">
            <RouterTable
              routers={routers}
              onClickModal={this.onClickModalCall}
            />
          </div>
        </Page.Contents> */}
        <Page.Contents scrollable={true}>
          <Threesizer
            orientation={HANDLE_HORIZONTAL}
            divisions={this.horizontalDivisions}
            onResize={this.handleResize}
          />
        </Page.Contents>
      </Page>
    )
  }

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
  }

  private renderRouterTable = () => {
    const {routers} = this.state
    return (
      <RouterTable routers={routers} onClickModal={this.onClickModalCall} />
    )
  }

  private renderTopSourceTable = () => {
    const {topSources} = this.state
    return <TopSourcesTable topSources={topSources} />
  }

  private get horizontalDivisions() {
    const {proportions} = this.state
    const [topSize, bottomSize] = proportions

    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: this.renderRouterTable,
        headerOrientation: HANDLE_HORIZONTAL,
        size: topSize,
      },
      {
        name: '',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: this.renderTopSourceTable,
        headerOrientation: HANDLE_HORIZONTAL,
        size: bottomSize,
      },
    ]
  }
}

export default SwanSdplexStatusPage
