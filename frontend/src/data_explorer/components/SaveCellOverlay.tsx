import React, {ChangeEvent, PureComponent} from 'react'

import {getNewDashboardCell} from 'src/dashboards/utils/cellGetters'
import {
  getCellTypeColors,
  normalizeTableGaugeChartOptions,
} from 'src/dashboards/constants/cellEditor'
import {
  TimeMachineContainer,
  TimeMachineContextConsumer,
} from 'src/shared/utils/TimeMachineContext'
import {buildRawText} from 'src/utils/influxql'

import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
  Button,
  ComponentColor,
  ComponentStatus,
  Input,
} from 'src/reusable_ui'

import {STATIC_LEGEND} from 'src/dashboards/constants/cellEditor'
import {NEW_EMPTY_DASHBOARD} from 'src/dashboards/constants'
import {
  notifyLibraryCellSaved,
  notifyLibraryCellSaveFailed,
  notifyLibraryCellUpdated,
} from 'src/shared/copy/notifications'

import {
  createLibraryCell,
  getLibraryCells,
  updateLibraryCell,
} from 'src/dashboards/apis'

import {
  QueryConfig,
  CellQuery,
  TimeRange,
  Source,
  QueryType,
  Notification,
  StaticLegendPositionType,
} from 'src/types'
import {VisualizationOptions} from 'src/types/dataExplorer'
import {ColorString} from 'src/types/colors'
import {GraphOptions, Dashboard, LibraryCell} from 'src/types/dashboards'
import {TableGaugeChartOptionsInterface} from 'src/types/statisticalgraph'

interface PassedProps {
  source: Source
  onCancel: () => void
  notify: (message: Notification) => void
  activeQueryIndex: number
  editingLibraryCell?: LibraryCell
  initialSelectedItemId?: string
  onSavedLibraryCell?: (item: LibraryCell) => void
}

interface ConnectedProps {
  isStaticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  graphOptions: GraphOptions
  queryType: QueryType
  queryDrafts: CellQuery[]
  timeRange: TimeRange
  visualizationOptions: VisualizationOptions
  script: string
  tableGaugeChartOptions: TableGaugeChartOptionsInterface
}

type Props = PassedProps & ConnectedProps

interface State {
  selectedItemId: string
  name: string
  description: string
  sendAllQueries: boolean
  libraryCells: LibraryCell[]
}

class SaveCellOverlay extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      selectedItemId: '',
      name: props.editingLibraryCell?.name || '',
      description: props.editingLibraryCell?.description || '',
      sendAllQueries: false,
      libraryCells: [],
    }
  }

  public async componentDidMount() {
    const {editingLibraryCell, initialSelectedItemId} = this.props

    try {
      const result = await getLibraryCells()
      const libraryCells = result?.data?.libraryCells || []
      const fallbackSelectedID =
        editingLibraryCell?.id || initialSelectedItemId
      const selectedItemID = libraryCells.find(
        item => item.id === fallbackSelectedID
      )
        ? fallbackSelectedID
        : ''

      this.setState({
        libraryCells,
        selectedItemId: selectedItemID || '',
      })
    } catch {
      this.setState({libraryCells: []})
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

  public handleChangeName = e => {
    const name = e.target.value
    this.setState({name})
  }

  public handleChangeDescription = e => {
    const description = e.target.value
    this.setState({description})
  }

  public render() {
    const {onCancel, queryDrafts, queryType, editingLibraryCell} = this.props
    const {name, description, sendAllQueries} = this.state
    const multipleQueries =
      queryType === QueryType.InfluxQL && queryDrafts.length > 1

    return (
      <OverlayContainer>
        <OverlayHeading title="Save Cell" onDismiss={onCancel} />
        <OverlayBody>
          {this.hasQuery() ? (
            <Form>
              {/* {editingLibraryCell && (
                <Form.Element>
                  <div className="form-control-static">
                    <div>
                      Prev Cell Name:{' '}
                      <strong> {editingLibraryCell.name}</strong>
                      <br />
                      Prev Cell Description:{' '}
                      <b> {editingLibraryCell.description}</b>
                    </div>
                  </div>
                </Form.Element>
              )} */}
              <Form.Element label="Cell Name">
                <Input
                  value={name}
                  onChange={this.handleChangeName}
                  placeholder={'Name this cell item'}
                />
              </Form.Element>
              <Form.Element label="Cell Description">
                <Input
                  value={description}
                  onChange={this.handleChangeDescription}
                  placeholder={'Description for this cell item'}
                />
              </Form.Element>

              {multipleQueries && (
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
                {editingLibraryCell ? (
                  <>
                    <Button
                      color={ComponentColor.Success}
                      text="Save As"
                      titleText="Create a new cell item"
                      status={this.saveButtonStatus}
                      onClick={this.handleSaveAs}
                    />
                    <Button
                      color={ComponentColor.Primary}
                      text="Save"
                      titleText="Overwrite selected cell item"
                      status={this.saveButtonStatus}
                      onClick={this.handleSave}
                    />
                  </>
                ) : (
                  <Button
                    color={ComponentColor.Primary}
                    text="Save Cell"
                    titleText="Save as a new cell item"
                    status={this.saveButtonStatus}
                    onClick={this.handleSaveAs}
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

  private get saveButtonStatus(): ComponentStatus {
    const {name} = this.state
    if (name.trim().length === 0) {
      return ComponentStatus.Disabled
    }
    return ComponentStatus.Default
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

  private handleSave = async () => {
    const selectedID =
      this.state.selectedItemId || this.props.editingLibraryCell?.id
    if (!selectedID) {
      await this.handleSaveAs()
      return
    }
    await this.saveCell('save', selectedID)
  }

  private handleSaveAs = async () => {
    await this.saveCell('saveAs')
  }

  private saveCell = async (mode: 'save' | 'saveAs', selectedID?: string) => {
    const {name, description, sendAllQueries} = this.state
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

    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

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

    const emptyCell = getNewDashboardCell(NEW_EMPTY_DASHBOARD as Dashboard)
    const newCell = {
      ...emptyCell,
      name: trimmedName,
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

    try {
      let savedLibraryCell: LibraryCell
      if (mode === 'save' && selectedID) {
        const result = await updateLibraryCell(selectedID, {
          name: trimmedName,
          description: description.trim(),
          type,
          content: newCell as LibraryCell['content'],
        })
        savedLibraryCell = result?.data || {
          id: selectedID,
          name: trimmedName,
          description: description.trim(),
          type,
          content: newCell as LibraryCell['content'],
        }
        notify(notifyLibraryCellUpdated(trimmedName))
      } else if (mode === 'saveAs' && selectedID) {
        const result = await createLibraryCell({
          name: trimmedName,
          description: description.trim(),
          type,
          content: newCell as LibraryCell['content'],
        })
        savedLibraryCell = result?.data || {
          id: '',
          name: trimmedName,
          description: description.trim(),
          type,
          content: newCell as LibraryCell['content'],
        }
        notify(notifyLibraryCellSaved(trimmedName))
      } else {
        const result = await createLibraryCell({
          name: trimmedName,
          description: description.trim(),
          type,
          content: newCell as LibraryCell['content'],
        })
        savedLibraryCell = result?.data || {
          id: '',
          name: trimmedName,
          description: description.trim(),
          type,
          content: newCell as LibraryCell['content'],
        }
        notify(notifyLibraryCellSaved(trimmedName))
      }
      if (this.props.onSavedLibraryCell) {
        this.props.onSavedLibraryCell(savedLibraryCell)
      }
      onCancel()
    } catch {
      notify(notifyLibraryCellSaveFailed(trimmedName))
    }
  }
}

const ConnectedSaveCellOverlay = (props: PassedProps) => {
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
          <SaveCellOverlay
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

export default ConnectedSaveCellOverlay
