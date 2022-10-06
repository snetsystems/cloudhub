// Libraries
import React, {MouseEventHandler, PureComponent} from 'react'

// Types
import {RemoteDataState} from 'src/types'
import {CollectorConfigTableData} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Components
import CollectorConfigTab from 'src/agent_admin/components/CollectorConfigTab'
import CollectorConfigTable from 'src/agent_admin/components/CollectorConfigTable'
import PageSpinner from 'src/shared/components/PageSpinner'

interface Props {
  isCollectorInstalled: boolean
  activeSection: string
  selectedService: string[]
  collectorConfigTableData: CollectorConfigTableData
  serviceConfigStatus: RemoteDataState
  handleTabClick: (selectedSection: string) => MouseEventHandler<HTMLDivElement>
  handleUpdateEnableServices: (selectedEnableServices: string[]) => void
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSaveClick: () => void
}

interface State {
  collctorConfigPageStatus: RemoteDataState
}

@ErrorHandling
class CollectorConfig extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      collctorConfigPageStatus: RemoteDataState.Loading,
    }
  }

  public componentDidMount() {
    this.setState({
      collctorConfigPageStatus: this.props.serviceConfigStatus,
    })
  }

  public componentDidUpdate() {
    this.setState({
      collctorConfigPageStatus: this.props.serviceConfigStatus,
    })
  }

  private get ActiveSectionComponent() {
    const {isCollectorInstalled, activeSection} = this.props
    const {collctorConfigPageStatus} = this.state
    const sections = this.TabSections

    if (collctorConfigPageStatus === RemoteDataState.Error) {
      return this.ErrorState
    }

    if (
      collctorConfigPageStatus === RemoteDataState.Done &&
      !isCollectorInstalled
    ) {
      return this.NoInstalledCollector
    }

    const {component} = sections.find(
      section => section.name.toLocaleLowerCase() === activeSection
    )
    return component
  }

  private get TabSections() {
    const {
      collectorConfigTableData,
      selectedService,
      handleInputChange,
      handleUpdateEnableServices,
      handleSaveClick,
    } = this.props

    return [
      {
        name: 'Openstack',
        component: (
          <CollectorConfigTable
            collectorConfigTableData={collectorConfigTableData}
            selectedService={selectedService}
            handleInputChange={handleInputChange}
            handleUpdateEnableServices={handleUpdateEnableServices}
            handleSaveClick={handleSaveClick}
          />
        ),
      },
      // {
      //   name: 'Openshift',
      //   component: (
      //     <CollectorConfigTable
      //       collectorConfigTableData={collectorConfigTableData}
      //       selectedService={selectedService}
      //       handleInputChange={handleInputChange}
      //       handleUpdateEnableServices={handleUpdateEnableServices}
      //     />
      //   ),
      // },
    ]
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4>There was a problem loading Collector Config </h4>
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

  public render() {
    const {serviceConfigStatus, activeSection, handleTabClick} = this.props
    const sections = this.TabSections

    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">{'Collector Config'}</h2>
        </div>
        <div className="panel-body">
          {serviceConfigStatus === RemoteDataState.Loading
            ? this.LoadingState
            : null}
          <div className="row subsection">
            <div
              className="col-md-2 subsection--nav"
              data-test="subsectionNav"
              style={{
                paddingLeft: 'unset',
                height: '100%',
                backgroundColor: '#202028',
              }}
            >
              <div className="subsection--tabs">
                {sections.map(section => (
                  <CollectorConfigTab
                    key={section.name}
                    section={section}
                    activeSection={activeSection}
                    handleTabClick={handleTabClick}
                  />
                ))}
              </div>
            </div>
            <div
              className="col-md-10 subsection--content"
              data-test="subsectionContent"
              style={{backgroundColor: '#292933'}}
            >
              {this.ActiveSectionComponent}
            </div>
          </div>
        </div>
      </div>
    )
  }

  private get LoadingState(): JSX.Element {
    return (
      <div
        style={{
          position: 'absolute',
          zIndex: 7,
          backgroundColor: 'rgba(0,0,0,0.5)',
          width: '70.7%',
          height: '100%',
          marginLeft: '-1.2%',
        }}
      >
        <PageSpinner />
      </div>
    )
  }
}

export default CollectorConfig
