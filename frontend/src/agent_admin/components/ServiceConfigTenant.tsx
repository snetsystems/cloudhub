// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'

// Components
import PageSpinner from 'src/shared/components/PageSpinner'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import ServiceConfigRow from 'src/agent_admin/components/ServiceConfigRow'

// Types
import {RemoteDataState} from 'src/types'
import {AgentDirFile} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

type Tenant = string

interface Props {
  focusedMinion: string
  focusedTenant: string
  isCollectorInstalled: boolean
  serviceConfigStatus: RemoteDataState
  projectFileList: AgentDirFile
  onClickTableRow: (selectedData: any) => () => void
}

interface State {
  serviceConfigTenantStatus: RemoteDataState
}

@ErrorHandling
class ServiceConfigTenant extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      serviceConfigTenantStatus: RemoteDataState.Loading,
    }
  }

  public componentDidMount() {
    this.setState({
      serviceConfigTenantStatus: this.props.serviceConfigStatus,
    })
  }

  public componentDidUpdate() {
    this.setState({
      serviceConfigTenantStatus: this.props.serviceConfigStatus,
    })
  }

  public render() {
    const {serviceConfigStatus, projectFileList} = this.props
    const isLoadingTenantList =
      projectFileList.files.length !== 0 && projectFileList.isLoading

    return (
      <>
        <div className="panel">
          <div className="panel-heading">
            <h2 className="panel-title">{'Tenant'}</h2>
          </div>

          <div className="panel-body" style={{position: 'relative'}}>
            {serviceConfigStatus === RemoteDataState.Loading ||
            isLoadingTenantList
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
    const {serviceConfigTenantStatus} = this.state

    if (serviceConfigTenantStatus === RemoteDataState.Error) {
      return this.ErrorState
    }
    if (
      serviceConfigTenantStatus === RemoteDataState.Done &&
      this.isEmptyData()
    ) {
      return this.NoDataState
    }

    if (
      serviceConfigTenantStatus === RemoteDataState.Done &&
      !isCollectorInstalled
    ) {
      return this.NoInstalledCollector
    }

    return this.TenantTable
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4>There was a problem loading Tenant </h4>
      </div>
    )
  }

  private isEmptyData = () => {
    const {projectFileList} = this.props

    return (
      projectFileList.files.length === 0 ||
      projectFileList.files[0].application === '<< Empty >>'
    )
  }

  private get NoDataState(): JSX.Element {
    const {focusedMinion} = this.props
    const stateText =
      focusedMinion === '' ? 'Minion not selected' : 'No Tenant found'

    return (
      <div className="agent--state generic-empty-state">
        <h4>{stateText}</h4>
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

  private get Tenant() {
    const {projectFileList} = this.props

    return projectFileList?.files.map(file => file.application)
  }

  private get TenantTable() {
    const {focusedTenant, onClickTableRow} = this.props
    const tenants = this.Tenant

    return (
      <div className="hosts-table">
        {tenants.length > 0 ? (
          <FancyScrollbar
            style={{backgroundColor: 'transparent'}}
            children={tenants.map(
              (t: Tenant, i: number): JSX.Element => (
                <ServiceConfigRow
                  key={i}
                  tableRowData={t}
                  onClickTableRow={onClickTableRow}
                  focusedRowData={focusedTenant}
                />
              )
            )}
            className="hosts-table--tbody"
          />
        ) : null}
      </div>
    )
  }
}

export default ServiceConfigTenant
