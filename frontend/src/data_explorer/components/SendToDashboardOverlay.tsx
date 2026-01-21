// Libraries
import React, {ChangeEvent, PureComponent} from 'react'
import _ from 'lodash'

// Utils
import {getNewDashboardCell} from 'src/dashboards/utils/cellGetters'
import {
  getCellTypeColors,
  normalizeTableGaugeChartOptions,
} from 'src/dashboards/constants/cellEditor'
import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants'
import {
  TimeMachineContainer,
  TimeMachineContextConsumer,
} from 'src/shared/utils/TimeMachineContext'
import {buildRawText} from 'src/utils/influxql'

// Components
import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  MultiSelectDropdown,
  Form,
  Button,
  ComponentColor,
  ComponentStatus,
  Input,
  Dropdown,
} from 'src/reusable_ui'

// Constants
import {STATIC_LEGEND} from 'src/dashboards/constants/cellEditor'
import {NEW_EMPTY_DASHBOARD} from 'src/dashboards/constants'
import {
  notifyCellSent,
  notifyCellSendFailed,
} from 'src/shared/copy/notifications'
import {defaultSuccessNotification, defaultErrorNotification} from 'src/shared/copy/notifications'

// APIs
import {createDashboard, createDashboardItem} from 'src/dashboards/apis'

// Types
import {
  QueryConfig,
  CellQuery,
  TimeRange,
  Dashboard,
  Source,
  Cell,
  QueryType,
  Notification,
  StaticLegendPositionType,
} from 'src/types'
import {VisualizationOptions} from 'src/types/dataExplorer'
import {ColorString} from 'src/types/colors'
import {GraphOptions} from 'src/types/dashboards'
import {TableGaugeChartOptionsInterface} from 'src/types/statisticalgraph'

interface PassedProps {
  dashboards: Dashboard[]
  source: Source
  onCancel: () => void
  sendDashboardCell: (
    dashboard: Dashboard,
    newCell: Partial<Cell>
  ) => Promise<{success: boolean; dashboard: Dashboard}>
  handleGetDashboards: () => Dashboard[]
  notify: (message: Notification) => void
  activeQueryIndex: number
}

interface ConnectedProps {
  isStaticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  graphOptions: GraphOptions
  queryType: QueryType
  queryDrafts: CellQuery[]
  timeRange: TimeRange
  visualizationOptions: VisualizationOptions
  script: string // flux script
  tableGaugeChartOptions: TableGaugeChartOptionsInterface
}

type Props = PassedProps & ConnectedProps

interface State {
  selectedIDs: string[]
  name: string
  newDashboardName: string
  sendAllQueries: boolean
  saveToLibrary: boolean
  description: string
  itemType: string
}

const NEW_DASHBOARD_ID = 'new'

class SendToDashboardOverlay extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      selectedIDs: [],
      name: '',
      newDashboardName: '',
      sendAllQueries: false,
      saveToLibrary: false,
      description: '',
      itemType: 'line',
    }
  }
  private onSendAllQueriesCheckChange = (
    val: ChangeEvent<HTMLInputElement>
  ): void => {
    this.setState({sendAllQueries: val.target.checked})
  }
  private onSendActiveQueriesCheckChange = (
    val: ChangeEvent<HTMLInputElement>
  ): void => {
    this.setState({sendAllQueries: !val.target.checked})
  }
  public async componentDidMount() {
    const {handleGetDashboards} = this.props
    await handleGetDashboards()
  }

  public handleChangeName = e => {
    const name = e.target.value
    this.setState({name})
  }

  public handleChangeNewDashboardName = e => {
    const newDashboardName = e.target.value
    this.setState({newDashboardName})
  }

  public handleChangeDescription = e => {
    const description = e.target.value
    this.setState({description})
  }

  public handleChangeItemType = (value: string) => {
    this.setState({itemType: value})
  }

  public handleToggleSaveToLibrary = (e?: ChangeEvent<HTMLInputElement>) => {
    if (e) {
      this.setState({saveToLibrary: e.target.value === 'library'})
    } else {
      this.setState({saveToLibrary: !this.state.saveToLibrary})
    }
  }

  public render() {
    const {onCancel, queryDrafts, queryType} = this.props
    const {name, selectedIDs, newDashboardName, sendAllQueries} = this.state

    const numberDashboards = selectedIDs.length > 1 ? selectedIDs.length : ''
    const pluralizer = selectedIDs.length > 1 ? 's' : ''
    const multipleQueries =
      queryType === QueryType.InfluxQL && queryDrafts.length > 1

    return (
      <OverlayContainer>
        <OverlayHeading title="Send to Dashboard" onDismiss={onCancel} />
        <OverlayBody>
          {this.hasQuery() ? (
            <Form>
              <Form.Element label="Save Location">
                <div className="form-group col-xs-12">
                  <div className="form-control-static">
                    <div className="radio-item">
                      <input
                        id="send_to_dashboard_option"
                        type="radio"
                        name="saveLocationRadio"
                        value="dashboard"
                        checked={!this.state.saveToLibrary}
                        onChange={() => this.setState({saveToLibrary: false})}
                      />
                      <label
                        htmlFor="send_to_dashboard_option"
                        title="Send to existing dashboard(s)"
                      >
                        Send to Dashboard
                      </label>
                    </div>
                    <div className="radio-item">
                      <input
                        id="save_to_library_option"
                        type="radio"
                        name="saveLocationRadio"
                        value="library"
                        checked={this.state.saveToLibrary}
                        onChange={() => this.setState({saveToLibrary: true})}
                      />
                      <label
                        htmlFor="save_to_library_option"
                        title="Save to Library Panel"
                      >
                        Save to Library Panel
                      </label>
                    </div>
                  </div>
                </div>
              </Form.Element>
              {!this.state.saveToLibrary && (
                <Form.Element label="Target Dashboard(s)">
                  <MultiSelectDropdown
                    onChange={this.handleSelect}
                    selectedIDs={this.state.selectedIDs}
                    emptyText="Choose at least 1 dashboard"
                  >
                    {this.dropdownItems}
                  </MultiSelectDropdown>
                </Form.Element>
              )}
              {!this.state.saveToLibrary && this.isNewDashboardSelected && (
                <Form.Element label="Name new dashboard">
                  <Input
                    value={newDashboardName}
                    onChange={this.handleChangeNewDashboardName}
                    placeholder={'Name new dashboard'}
                  />
                </Form.Element>
              )}
              {!this.state.saveToLibrary && (
                <Form.Element label="Cell Name">
                  <Input
                    value={name}
                    onChange={this.handleChangeName}
                    placeholder={'Name this new cell'}
                  />
                </Form.Element>
              )}
              {this.state.saveToLibrary && (
                <Form.Element label="Name">
                  <Input
                    value={name}
                    onChange={this.handleChangeName}
                    placeholder={'Name this dashboard item'}
                  />
                </Form.Element>
              )}
              {this.state.saveToLibrary && (
                <Form.Element label="Type">
                  <Dropdown
                    selectedID={this.state.itemType}
                    onChange={this.handleChangeItemType}
                    buttonColor={ComponentColor.Default}
                  >
                    <Dropdown.Item id="line" value="line">
                      Line
                    </Dropdown.Item>
                    <Dropdown.Item id="stacked" value="stacked">
                      Stacked
                    </Dropdown.Item>
                    <Dropdown.Item id="step-plot" value="step-plot">
                      Step Plot
                    </Dropdown.Item>
                    <Dropdown.Item id="bar" value="bar">
                      Bar
                    </Dropdown.Item>
                    <Dropdown.Item id="line-plus-single-stat" value="line-plus-single-stat">
                      Line + Single Stat
                    </Dropdown.Item>
                    <Dropdown.Item id="single-stat" value="single-stat">
                      Single Stat
                    </Dropdown.Item>
                    <Dropdown.Item id="gauge" value="gauge">
                      Gauge
                    </Dropdown.Item>
                    <Dropdown.Item id="table" value="table">
                      Table
                    </Dropdown.Item>
                  </Dropdown>
                </Form.Element>
              )}
              {this.state.saveToLibrary && (
                <Form.Element label="Description">
                  <Input
                    value={this.state.description}
                    onChange={this.handleChangeDescription}
                    placeholder={'Description (optional)'}
                  />
                </Form.Element>
              )}
              {!this.state.saveToLibrary && multipleQueries && (
                <Form.Element label="Queries">
                  <div className="form-group col-xs-12">
                    <div className="form-control-static">
                      <div className="radio-item">
                        <input
                          id="active_query_option"
                          type="radio"
                          name="queriesRadio"
                          value="active"
                          checked={!sendAllQueries}
                          onChange={this.onSendActiveQueriesCheckChange}
                        />
                        <label
                          htmlFor="active_query_option"
                          title="Query from the selected tab"
                        >
                          Active Query
                        </label>
                      </div>
                      <div className="radio-item">
                        <input
                          id="all_queries_option"
                          type="radio"
                          name="queriesRadio"
                          value="all"
                          checked={sendAllQueries}
                          onChange={this.onSendAllQueriesCheckChange}
                        />
                        <label
                          htmlFor="all_queries_option"
                          title="Queries from all tabs"
                        >
                          All Queries
                        </label>
                      </div>
                    </div>
                  </div>
                </Form.Element>
              )}
              <Form.Footer>
                {this.state.saveToLibrary ? (
                  <Button
                    color={ComponentColor.Success}
                    text="Save Item"
                    titleText="Must set a name"
                    status={this.saveItemButtonStatus}
                    onClick={this.saveToLibrary}
                  />
                ) : (
                  <Button
                    color={ComponentColor.Success}
                    text={`Send to ${numberDashboards} Dashboard${pluralizer}`}
                    titleText="Must choose at least 1 dashboard and set a name"
                    status={this.submitButtonStatus}
                    onClick={this.sendToDashboard}
                  />
                )}
                <Button text="Cancel" onClick={onCancel} />
              </Form.Footer>
            </Form>
          ) : (
            <Form>
              <Form.Element>
                <div className="text-center">
                  No
                  {this.props.queryType === QueryType.Flux
                    ? ' script '
                    : ' query '}
                  specified!
                </div>
              </Form.Element>
              <Form.Footer>
                <Button text="Back" onClick={onCancel} />
              </Form.Footer>
            </Form>
          )}
        </OverlayBody>
      </OverlayContainer>
    )
  }

  private get dropdownItems(): JSX.Element[] {
    const {dashboards} = this.props
    const {newDashboardName} = this.state

    const simpleArray = _.sortBy(
      dashboards.map(d => ({
        id: d.id.toString(),
        name: d.name,
      })),
      element => {
        return element.name.toLowerCase()
      }
    )

    const items = simpleArray.map(dashboard => {
      return (
        <MultiSelectDropdown.Item
          key={dashboard.id}
          id={dashboard.id}
          value={dashboard}
        >
          {dashboard.name}
        </MultiSelectDropdown.Item>
      )
    })

    const newDashboardItem = (
      <MultiSelectDropdown.Item
        key={NEW_DASHBOARD_ID}
        id={NEW_DASHBOARD_ID}
        value={{
          id: NEW_DASHBOARD_ID,
          name: newDashboardName,
        }}
      >
        Send to a New Dashboard
      </MultiSelectDropdown.Item>
    )

    const divider = (
      <MultiSelectDropdown.Divider key={'divider'} id={'divider'} />
    )

    return [newDashboardItem, divider, ...items]
  }

  private get isNewDashboardSelected(): boolean {
    return this.state.selectedIDs.includes(NEW_DASHBOARD_ID)
  }

  private get activeQueryConfig(): QueryConfig {
    const {queryDrafts, activeQueryIndex} = this.props
    if (queryDrafts === undefined || queryDrafts.length === 0) {
      return undefined
    }
    if (activeQueryIndex < queryDrafts.length) {
      return queryDrafts[activeQueryIndex].queryConfig
    }
    return queryDrafts[0].queryConfig
  }

  private rawText = (queryConfig: QueryConfig | undefined): string => {
    const {timeRange} = this.props

    if (queryConfig) {
      return buildRawText(queryConfig, timeRange)
    }

    return ''
  }

  private hasQuery(): boolean {
    const {script, queryType} = this.props
    if (queryType === QueryType.Flux) {
      return script && !!script.trim()
    }
    const rawText = this.rawText(this.activeQueryConfig)
    return rawText && !!rawText.trim()
  }

  private get selectedDashboards(): Dashboard[] {
    const {dashboards} = this.props
    const {selectedIDs} = this.state

    return dashboards.filter(d => {
      return selectedIDs.includes(d.id.toString())
    })
  }

  private get submitButtonStatus(): ComponentStatus {
    const {name, selectedIDs} = this.state

    if (selectedIDs.length === 0 || name.trim().length === 0) {
      return ComponentStatus.Disabled
    }

    return ComponentStatus.Default
  }

  private get saveItemButtonStatus(): ComponentStatus {
    const {name} = this.state

    if (name.trim().length === 0) {
      return ComponentStatus.Disabled
    }

    return ComponentStatus.Default
  }

  private handleSelect = async (selectedIDs: string[]) => {
    this.setState({selectedIDs})
  }

  private notifyResolutions = (
    resolved: Array<{success: boolean; dashboard: Dashboard}>,
    cellName: string
  ) => {
    const {notify} = this.props
    const failures = resolved.filter(r => r.success === false)
    if (failures.length === 0) {
      notify(notifyCellSent(cellName, resolved.length))
      return
    }
    failures.forEach(f => {
      notify(notifyCellSendFailed(cellName, f.dashboard.name))
    })
  }

  private sendToDashboard = async () => {
    const {name, newDashboardName, sendAllQueries} = this.state
    const {
      queryType,
      script,
      sendDashboardCell,
      source,
      onCancel,
      visualizationOptions,
      graphOptions,
      isStaticLegend,
      staticLegendPosition,
      queryDrafts,
      tableGaugeChartOptions,
    } = this.props
    const {
      type,
      gaugeColors,
      thresholdsListColors,
      lineColors,
      axes,
      decimalPlaces,
      timeFormat,
      note,
      noteVisibility,
      fieldOptions,
      tableOptions,
    } = visualizationOptions
    const isFluxQuery = queryType === QueryType.Flux

    let newCellQueries: CellQuery[]

    if (isFluxQuery) {
      newCellQueries = [
        {
          queryConfig: null,
          query: script,
          source: source.links.self,
          type: QueryType.Flux,
        },
      ]
    } else {
      const createInfluxQLCellQuery = (queryConfig: QueryConfig): CellQuery => {
        const rawText = this.rawText(queryConfig)
        return {
          queryConfig,
          query: rawText,
          source: source.links.self,
          type: QueryType.InfluxQL,
        }
      }
      // InfluxQL
      if (sendAllQueries) {
        newCellQueries = queryDrafts.reduce((acc, val) => {
          acc.push(createInfluxQLCellQuery(val.queryConfig))
          return acc
        }, [])
      } else {
        newCellQueries = [createInfluxQLCellQuery(this.activeQueryConfig)]
      }
    }

    const colors: ColorString[] = getCellTypeColors({
      cellType: type,
      gaugeColors,
      thresholdsListColors,
      lineColors,
    })

    const legend = isStaticLegend
      ? {...STATIC_LEGEND, orientation: staticLegendPosition}
      : {orientation: staticLegendPosition}

    let selectedDashboards = this.selectedDashboards

    if (this.isNewDashboardSelected) {
      let result

      if (newDashboardName === '') {
        result = await createDashboard(NEW_EMPTY_DASHBOARD)
      } else {
        result = await createDashboard({
          ...NEW_EMPTY_DASHBOARD,
          name: newDashboardName,
        })
      }

      const newDashboard: Dashboard = result.data
      selectedDashboards = [...selectedDashboards, newDashboard]
    }

    const resolved = await Promise.all(
      selectedDashboards.map(dashboard => {
        const emptyCell = getNewDashboardCell(dashboard)
        const newCell: Partial<Cell> = {
          ...emptyCell,
          name,
          queries: newCellQueries,
          type,
          axes,
          legend,
          colors,
          decimalPlaces,
          timeFormat,
          note,
          noteVisibility,
          fieldOptions,
          tableOptions,
          graphOptions,
          tableGaugeChartOptions: normalizeTableGaugeChartOptions(
            tableGaugeChartOptions
          ),
        }

        return sendDashboardCell(dashboard, newCell)
      })
    )
    this.notifyResolutions(resolved, name)
    onCancel()
  }

  private saveToLibrary = async () => {
    const {name, description, itemType} = this.state
    const {
      queryType,
      script,
      source,
      onCancel,
      notify,
      visualizationOptions,
      graphOptions,
      isStaticLegend,
      staticLegendPosition,
      queryDrafts,
      tableGaugeChartOptions,
    } = this.props
    const {
      type,
      gaugeColors,
      thresholdsListColors,
      lineColors,
      axes,
      decimalPlaces,
      timeFormat,
      note,
      noteVisibility,
      fieldOptions,
      tableOptions,
    } = visualizationOptions
    const isFluxQuery = queryType === QueryType.Flux

    let newCellQueries: CellQuery[]

    if (isFluxQuery) {
      newCellQueries = [
        {
          queryConfig: null,
          query: script,
          source: source.links.self,
          type: QueryType.Flux,
        },
      ]
    } else {
      const createInfluxQLCellQuery = (queryConfig: QueryConfig): CellQuery => {
        const rawText = this.rawText(queryConfig)
        return {
          queryConfig,
          query: rawText,
          source: source.links.self,
          type: QueryType.InfluxQL,
        }
      }
      newCellQueries = [createInfluxQLCellQuery(this.activeQueryConfig)]
    }

    const colors: ColorString[] = getCellTypeColors({
      cellType: type,
      gaugeColors,
      thresholdsListColors,
      lineColors,
    })

    const legend = isStaticLegend
      ? {...STATIC_LEGEND, orientation: staticLegendPosition}
      : {orientation: staticLegendPosition}

    // Use NEW_DEFAULT_DASHBOARD_CELL directly since we don't need dashboard context
    // Generate a unique ID for the cell
    const cellId = `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const cellContent: Partial<Cell> = {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: cellId, // Add unique ID for the cell
      name,
      queries: newCellQueries,
      type: itemType as any, // Use selected itemType instead of visualizationOptions.type
      axes,
      legend,
      colors,
      decimalPlaces,
      timeFormat,
      note,
      noteVisibility,
      fieldOptions,
      tableOptions,
      graphOptions,
      tableGaugeChartOptions: normalizeTableGaugeChartOptions(
        tableGaugeChartOptions
      ),
    }

    try {
      const response = await createDashboardItem({
        name,
        description: description || undefined,
        type: itemType,
        content: cellContent as Cell,
      })
      
      console.log('Dashboard item created:', response)
      notify({
        ...defaultSuccessNotification,
        icon: 'dash-h',
        message: `Dashboard item "${name}" saved successfully`,
      } as Notification)
      onCancel()
    } catch (error) {
      notify({
        ...defaultErrorNotification,
        icon: 'dash-h',
        message: `Failed to save dashboard item: ${error.message || 'Unknown error'}`,
      } as Notification)
    }
  }
}

const ConnectedSendToDashboardOverlay = (props: PassedProps) => {
  return (
    <TimeMachineContextConsumer>
      {(timeMachineContainer: TimeMachineContainer) => {
        const {
          type,
          tableOptions,
          fieldOptions,
          timeFormat,
          decimalPlaces,
          note,
          noteVisibility,
          axes,
          thresholdsListColors,
          thresholdsListType,
          gaugeColors,
          lineColors,
          queryType,
          queryDrafts,
          timeRange,
          draftScript,
          graphOptions,
          isStaticLegend,
          staticLegendPosition,
          tableGaugeChartOptions,
        } = timeMachineContainer.state

        const visualizationOptions = {
          type,
          axes,
          tableOptions,
          fieldOptions,
          timeFormat,
          decimalPlaces,
          note,
          noteVisibility,
          thresholdsListColors,
          gaugeColors,
          lineColors,
          thresholdsListType,
        }

        return (
          <SendToDashboardOverlay
            {...props}
            graphOptions={graphOptions}
            queryType={queryType}
            queryDrafts={queryDrafts}
            timeRange={timeRange}
            script={draftScript}
            visualizationOptions={visualizationOptions}
            isStaticLegend={isStaticLegend}
            staticLegendPosition={staticLegendPosition}
            tableGaugeChartOptions={tableGaugeChartOptions}
          />
        )
      }}
    </TimeMachineContextConsumer>
  )
}

export default ConnectedSendToDashboardOverlay
