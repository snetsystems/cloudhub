// Libraries
import React, {MouseEventHandler, PureComponent} from 'react'
import {EditorChange} from 'codemirror'

// Types
import {RemoteDataState} from 'src/types'
import {
  CollectorConfigTabData,
  CollectorConfigTableData,
  CollectorConfigTabName,
} from 'src/agent_admin/type'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Components
import CollectorConfigTab from 'src/agent_admin/components/CollectorConfigTab'
import CollectorConfigTable from 'src/agent_admin/components/CollectorConfigTable'
import PageSpinner from 'src/shared/components/PageSpinner'
import {Radio} from 'src/reusable_ui'
import AgentCodeEditor from 'src/agent_admin/components/AgentCodeEditor'

interface Props {
  isCollectorInstalled: boolean
  focusedCollectorConfigTab: CollectorConfigTabName | ''
  configScript: string
  inputConfigScript: string
  selectedService: string[]
  collectorConfigTableTabs: CollectorConfigTabName[]
  collectorConfigTableData: CollectorConfigTableData
  serviceConfigStatus: RemoteDataState
  configEditStyle: 'basic' | 'toml'
  handleTabClick: (selectedSection: string) => MouseEventHandler<HTMLDivElement>
  handleUpdateEnableServices: (selectedEnableServices: string[]) => void
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSaveClick: () => void
  handleClickConfigEditStyle: (configEditstyle: string) => void
  handleBeforeChangeScript: (
    _: CodeMirror.Editor,
    __: EditorChange,
    ___: string
  ) => void
  handleChangeScript: (
    _: CodeMirror.Editor,
    __: EditorChange,
    ___: string
  ) => void
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
    const {isCollectorInstalled, focusedCollectorConfigTab} = this.props
    const {collctorConfigPageStatus} = this.state

    if (collctorConfigPageStatus === RemoteDataState.Error) {
      return this.ErrorState
    }

    if (
      collctorConfigPageStatus === RemoteDataState.Done &&
      !isCollectorInstalled
    ) {
      return this.NoInstalledCollector
    }

    if (focusedCollectorConfigTab === '') {
      return this.TabIsNotSelected
    }

    return this.TabSections
  }

  private get TabSections() {
    const {configEditStyle, focusedCollectorConfigTab} = this.props
    const sections = this.BasicTable

    if (configEditStyle === 'basic') {
      const {component} = sections.find(
        section => section.name === focusedCollectorConfigTab
      )

      return sections.length === 0 ? this.TabIsNotActivated : component
    }

    return sections.length === 0 ? this.TabIsNotActivated : this.CodeEditor
  }

  private get CodeEditor() {
    const {
      inputConfigScript,
      handleBeforeChangeScript,
      handleChangeScript,
    } = this.props

    return (
      <>
        <div
          className="collect-config--half"
          style={{
            marginTop: '1%',
            marginLeft: '1%',
            height: '89.2%',
            width: '99.5%',
          }}
        >
          <AgentCodeEditor
            configScript={inputConfigScript}
            onBeforeChangeScript={handleBeforeChangeScript}
            onChangeScript={handleChangeScript}
          />
        </div>
        {this.SaveButton}
      </>
    )
  }

  private get SaveButton() {
    const {handleSaveClick} = this.props
    const buttonClassName = 'button button-sm button-primary'
    const buttonStyle = {margin: '2.2% 0% 0% 48%'}
    const buttonName = 'Save'

    return (
      <button
        className={buttonClassName}
        style={buttonStyle}
        onClick={handleSaveClick}
      >
        {buttonName}
      </button>
    )
  }

  private get BasicTable() {
    const {
      collectorConfigTableTabs,
      collectorConfigTableData,
      selectedService,
      handleInputChange,
      handleUpdateEnableServices,
      handleSaveClick,
    } = this.props

    const collectorConfigTabComponents: CollectorConfigTabData[] = [
      {
        name: 'openstack',
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
      {
        name: 'openshift',
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
    ]

    return collectorConfigTabComponents.filter(
      collectorConfigTabComponent =>
        collectorConfigTableTabs.indexOf(collectorConfigTabComponent.name) !==
        -1
    )
  }

  private get ErrorState(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4>There was a problem loading Collector Config </h4>
      </div>
    )
  }

  private get TabIsNotSelected(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4 style={{margin: '90px 0'}}>Tab is not selected.</h4>
      </div>
    )
  }

  private get TabIsNotActivated(): JSX.Element {
    return (
      <div className="agent--state generic-empty-state">
        <h4 style={{margin: '90px 0'}}>Tab is not Activated.</h4>
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
    const {
      configEditStyle,
      serviceConfigStatus,
      focusedCollectorConfigTab,
      handleTabClick,
      handleClickConfigEditStyle,
    } = this.props
    const sections = this.BasicTable

    return (
      <div className="panel">
        <div className="panel-heading">
          <h2 className="panel-title">{'Collector Config'}</h2>
          <div
            className="radio-buttons radio-buttons--default radio-buttons--sm"
            style={{marginRight: '-14px'}}
          >
            <Radio.Button
              key={'basic'}
              id={'basic'}
              titleText={'basic'}
              value={'basic'}
              active={configEditStyle === 'basic'}
              onClick={handleClickConfigEditStyle}
            >
              {'Basic'}
            </Radio.Button>
            <Radio.Button
              key={'toml'}
              id={'toml'}
              titleText={'toml'}
              value={'toml'}
              active={configEditStyle === 'toml'}
              onClick={handleClickConfigEditStyle}
            >
              {'TOML'}
            </Radio.Button>
          </div>
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
                    focusedCollectorConfigTab={focusedCollectorConfigTab}
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
