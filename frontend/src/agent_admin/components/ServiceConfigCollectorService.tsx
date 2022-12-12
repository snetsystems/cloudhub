// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import PageSpinner from 'src/shared/components/PageSpinner'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import ServiceConfigRow from 'src/agent_admin/components/ServiceConfigRow'

// Types
import {RemoteDataState} from 'src/types'
import {Minion} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  focusedMinion: string
  isCollectorInstalled: boolean
  serviceConfigStatus: RemoteDataState
  minions: Minion[]
  onClickTableRow: (selectedData: any) => () => void
}

interface State {
  serviceConfigTableStatus: RemoteDataState
}

@ErrorHandling
class ServiceConfigCollectorService extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      serviceConfigTableStatus: RemoteDataState.Loading,
    }
  }

  public componentDidMount() {
    this.setState({
      serviceConfigTableStatus: this.props.serviceConfigStatus,
    })
  }

  public componentDidUpdate() {
    this.setState({
      serviceConfigTableStatus: this.props.serviceConfigStatus,
    })
  }

  public render() {
    const {serviceConfigStatus} = this.props

    return (
      <>
        <div className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">{'Collector Service'}</h2>
          </div>
          <div className="panel-body" style={{position: 'relative'}}>
            {serviceConfigStatus === RemoteDataState.Loading
              ? this.LoadingState
              : null}
            {this.AgentTableContents}
          </div>
        </div>
      </>
    )
  }

  private get LoadingState(): JSX.Element {
    return (
      <div
        style={{
          position: 'absolute',
          zIndex: 7,
          backgroundColor: 'rgba(0,0,0,0.5)',
          width: '100%',
          height: '100%',
        }}
      >
        <PageSpinner />
      </div>
    )
  }

  private get AgentTableContents(): JSX.Element {
    const {isCollectorInstalled} = this.props
    const {serviceConfigTableStatus} = this.state

    if (serviceConfigTableStatus === RemoteDataState.Error) {
      return this.ErrorState
    }
    if (
      serviceConfigTableStatus === RemoteDataState.Done &&
      this.isEmptyData()
    ) {
      return this.NoDataState
    }

    if (
      serviceConfigTableStatus === RemoteDataState.Done &&
      !isCollectorInstalled
    ) {
      return this.NoInstalledCollector
    }

    return this.CollectorServerTable
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4>There was a problem loading Collector Service </h4>
      </div>
    )
  }

  private isEmptyData = () => {
    const {minions} = this.props

    return minions.length === 0
  }

  private get NoDataState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4>No Collector Service found</h4>
      </div>
    )
  }

  private get NoInstalledCollector(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4 style={{margin: '90px 0'}}>There is no installed collector.</h4>
      </div>
    )
  }

  private get CollectorServerTable() {
    const {minions, focusedMinion, onClickTableRow} = this.props
    const filteredMinion = minions.filter((m: Minion) => m.isInstall === true)

    return (
      <div className="hosts-table">
        {filteredMinion.length > 0 ? (
          <FancyScrollbar
            style={{backgroundColor: 'transparent'}}
            children={filteredMinion.map(
              (m: Minion, i: number): JSX.Element =>
                m.os && m.os.toLocaleLowerCase() !== 'windows' ? (
                  <ServiceConfigRow
                    key={i}
                    tableRowData={m}
                    onClickTableRow={onClickTableRow}
                    focusedRowData={focusedMinion}
                  />
                ) : null
            )}
            className="hosts-table--tbody"
          />
        ) : null}
      </div>
    )
  }
}

export default ServiceConfigCollectorService
