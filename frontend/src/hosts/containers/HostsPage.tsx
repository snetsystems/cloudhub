// Libraries
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'

// Containers
import HostsPageHostTab from 'src/hosts/containers/HostsPageHostTab'
import HostsPageAwsTab from 'src/hosts/containers/HostsPageAwsTab'
import HostsPageGcpTab from 'src/hosts/containers/HostsPageGcpTab'

// Components
import {ManualRefreshProps} from 'src/shared/components/ManualRefresh'
import {ButtonShape, Radio} from 'src/reusable_ui'
import {ErrorHandling} from 'src/shared/decorators/errors'
import PageSpinner from 'src/shared/components/PageSpinner'

//Middleware
import {getLocalStorage} from 'src/shared/middleware/localStorage'

// Types
import {Source, Links, Layout, TimeRange, RemoteDataState} from 'src/types'
import {CloudServiceProvider} from 'src/hosts/types/cloud'

interface Props extends ManualRefreshProps {
  source: Source
  links: Links
  timeRange: TimeRange
}

interface State {
  layouts: Layout[]
  activeCspTab: string
  itemCSPs: string[]
  HostsPageStatus: RemoteDataState
}

@ErrorHandling
export class HostsPage extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    manualRefresh: 0,
  }
  private isComponentMounted: boolean = true

  constructor(props: Props) {
    super(props)

    this.setState = (args, callback) => {
      if (!this.isComponentMounted) return
      PureComponent.prototype.setState.bind(this)(args, callback)
    }

    const addOnCsp = _.filter(_.values(CloudServiceProvider), csp => {
      return (
        _.get(
          _.find(this.props.links.addons, addon => addon.name === csp),
          'url',
          'off'
        ) === 'on'
      )
    })
    const itemCSPs = ['Host', ...addOnCsp]

    this.state = {
      activeCspTab: '',
      layouts: [],
      itemCSPs,
      HostsPageStatus: RemoteDataState.NotStarted,
    }

    this.onSetActiveCspTab = this.onSetActiveCspTab.bind(this)
  }

  public async componentDidMount() {
    const getLocalStorageInfrastructure = getLocalStorage('infrastructure')
    const defaultState = {
      focusedHost: '',
      focusedInstance: null,
      selectedAgent: 'ALL',
      selectedNamespace: 'ALL',
      activeCspTab: 'Host',
    }

    let hostsPage = _.get(
      getLocalStorageInfrastructure,
      'hostsPage',
      defaultState
    )

    const initActivateTab =
      this.state.itemCSPs.length === 1
        ? 'Host'
        : _.isEmpty(hostsPage['activeCspTab'])
        ? 'Host'
        : hostsPage['activeCspTab']

    this.setState({
      activeCspTab: initActivateTab,
      HostsPageStatus: RemoteDataState.Done,
    })
  }

  public componentWillUnmount() {
    this.isComponentMounted = false
  }

  public render() {
    return <>{this.activeTabRender}</>
  }
  private get activeTabRender(): JSX.Element {
    const {activeCspTab, HostsPageStatus} = this.state

    if (
      HostsPageStatus === RemoteDataState.Loading ||
      HostsPageStatus === RemoteDataState.NotStarted
    ) {
      return this.LoadingState
    }
    switch (activeCspTab) {
      case 'Host': {
        return <HostsPageHostTab {...this.props} tableTitle={this.tableTitle} />
      }
      case CloudServiceProvider.AWS: {
        return <HostsPageAwsTab {...this.props} tableTitle={this.tableTitle} />
      }
      case CloudServiceProvider.GCP: {
        return <HostsPageGcpTab {...this.props} tableTitle={this.tableTitle} />
      }
      default: {
        return <HostsPageHostTab {...this.props} tableTitle={this.tableTitle} />
      }
    }
  }
  private tableTitle = (): JSX.Element => {
    const {activeCspTab, itemCSPs} = this.state

    return itemCSPs.length > 1 ? (
      <Radio shape={ButtonShape.Default}>
        {_.map(itemCSPs, csp => {
          return (
            <Radio.Button
              key={csp}
              id="addon-tab-data"
              titleText={csp}
              value={csp}
              active={activeCspTab === csp}
              onClick={this.onSetActiveCspTab}
            >
              {csp.toUpperCase()}
            </Radio.Button>
          )
        })}
      </Radio>
    ) : (
      <div
        className={`radio-buttons radio-buttons--default radio-buttons--sm radio-buttons--stretch`}
      >
        <button type="button" className={'radio-button active'}>
          Private
        </button>
      </div>
    )
  }
  private get LoadingState(): JSX.Element {
    return <PageSpinner />
  }

  private onSetActiveCspTab(clickedTab: string): void {
    const {activeCspTab} = this.state
    if (clickedTab !== activeCspTab) {
      this.setState({
        activeCspTab: clickedTab,
      })
    }
  }
}

const mstp = state => {
  const {links} = state
  return {
    links,
  }
}

const mdtp = {}

export default connect(mstp, mdtp, null)(HostsPage)
