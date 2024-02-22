// Libraries
import React, {Component} from 'react'
import _ from 'lodash'

// Components
import GraphTypeSelector from 'src/dashboards/components/GraphTypeSelector'
import GaugeOptions from 'src/dashboards/components/GaugeOptions'
import SingleStatOptions from 'src/dashboards/components/SingleStatOptions'
import AxesOptions from 'src/dashboards/components/AxesOptions'
import TableOptions from 'src/dashboards/components/TableOptions'
import NoteOptions from 'src/dashboards/components/NoteOptions'
import CellNoteEditor from 'src/shared/components/TimeMachine/CellNoteEditor'
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import BarChartOptions from 'src/dashboards/components/BarChartOptions'
import DoughnutPieChartOptions from 'src/dashboards/components/DoughnutPieChartOptions'
import LineChartOptions from 'src/dashboards/components/LineChartOptions'
import RadarChartOptions from 'src/dashboards/components/RadarChartOptions'
import ScatterChartOptions from 'src/dashboards/components/ScatterChartOptions'

// Utils
import {
  TimeMachineContainer,
  TimeMachineContextConsumer,
} from 'src/shared/utils/TimeMachineContext'

// Constants
import {HANDLE_VERTICAL} from 'src/shared/constants'
import {DEFAULT_AXES} from 'src/dashboards/constants/cellEditor'

// Types
import {
  buildDefaultXLabel,
  buildDefaultYLabel,
  getGroupByTag,
} from 'src/shared/presenters'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {
  Axes,
  QueryConfig,
  CellType,
  QueryUpdateState,
  Template,
} from 'src/types'
import {
  FieldOption,
  DecimalPlaces,
  NoteVisibility,
  ThresholdType,
  TableOptions as TableOptionsInterface,
  StaticLegendPositionType,
  GraphOptions,
} from 'src/types/dashboards'
import {ColorNumber, ColorString} from 'src/types/colors'

interface ConnectedProps {
  type: CellType
  axes: Axes | null
  tableOptions: TableOptionsInterface
  fieldOptions: FieldOption[]
  timeFormat: string
  decimalPlaces: DecimalPlaces
  note: string
  noteVisibility: NoteVisibility
  thresholdsListColors: ColorNumber[]
  thresholdsListType: ThresholdType
  gaugeColors: ColorNumber[]
  lineColors: ColorString[]
  dashboardTemplates: Template[]
  graphOptions: GraphOptions
  onUpdateGraphOptions: (graphOptions: GraphOptions) => void
  onUpdateDecimalPlaces: TimeMachineContainer['handleUpdateDecimalPlaces']
  onUpdateGaugeColors: TimeMachineContainer['handleUpdateGaugeColors']
  onUpdateAxes: TimeMachineContainer['handleUpdateAxes']
  onUpdateTableOptions: TimeMachineContainer['handleUpdateTableOptions']
  onUpdateFieldOptions: TimeMachineContainer['handleUpdateFieldOptions']
  onUpdateTimeFormat: TimeMachineContainer['handleUpdateTimeFormat']
  onUpdateType: TimeMachineContainer['handleUpdateType']
  onUpdateNote: TimeMachineContainer['handleUpdateNote']
  onUpdateLineColors: TimeMachineContainer['handleUpdateLineColors']
  onUpdateNoteVisibility: TimeMachineContainer['handleUpdateNoteVisibility']
  onUpdateThresholdsListColors: TimeMachineContainer['handleUpdateThresholdsListColors']
  onUpdateThresholdsListType: TimeMachineContainer['handleUpdateThresholdsListType']
}

interface PassedProps {
  queryConfigs: QueryConfig[]
  staticLegend: boolean
  staticLegendPosition: StaticLegendPositionType
  stateToUpdate: QueryUpdateState
  dashboardTemplates: Template[]
  onResetFocus: () => void

  onToggleStaticLegendPosition: (
    staticLegendPosition: StaticLegendPositionType
  ) => void
  onToggleStaticLegend: (isStaticLegend: boolean) => void
}

type Props = PassedProps & ConnectedProps

interface State {
  defaultXLabel: string
  defaultYLabel: string
  proportions: number[]
}

@ErrorHandling
class DisplayOptions extends Component<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      defaultXLabel: this.defaultXLabel,
      defaultYLabel: this.defaultYLabel,
      proportions: [undefined, undefined, undefined],
    }
  }

  public componentDidUpdate(prevProps) {
    const {queryConfigs} = prevProps

    if (!_.isEqual(queryConfigs[0], this.props.queryConfigs[0])) {
      this.setState({
        defaultXLabel: this.defaultXLabel,
        defaultYLabel: this.defaultYLabel,
      })
    }
  }

  public render() {
    return (
      <Threesizer
        orientation={HANDLE_VERTICAL}
        divisions={this.threesizerDivisions}
        onResize={this.handleResize}
      />
    )
  }

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
  }

  private get threesizerDivisions() {
    const {
      type,
      note,
      noteVisibility,
      onUpdateType,
      onUpdateNote,
      onUpdateNoteVisibility,
    } = this.props

    const {proportions} = this.state
    const [leftSize, middleSize, rightSize] = proportions

    return [
      {
        name: 'Visualization Type',
        headerButtons: [],
        menuOptions: [],
        size: leftSize,
        render: () => (
          <GraphTypeSelector type={type} onUpdateVisType={onUpdateType} />
        ),
        headerOrientation: HANDLE_VERTICAL,
      },
      {
        name: 'Customize',
        headerButtons: [],
        menuOptions: [],
        size: middleSize,
        render: this.renderOptions,
        headerOrientation: HANDLE_VERTICAL,
      },
      {
        name: 'Add a Note',
        headerButtons: [],
        menuOptions: [],
        size: rightSize,
        render: () => (
          <CellNoteEditor
            note={note || ''}
            noteVisibility={noteVisibility}
            onUpdateNote={onUpdateNote}
            onUpdateNoteVisibility={onUpdateNoteVisibility}
          />
        ),
        headerOrientation: HANDLE_VERTICAL,
      },
    ]
  }

  private renderOptions = (): JSX.Element => {
    const {
      type,
      decimalPlaces,
      lineColors,
      gaugeColors,
      staticLegend,
      staticLegendPosition,
      onToggleStaticLegend,
      onToggleStaticLegendPosition,
      onResetFocus,
      queryConfigs,
      thresholdsListType,
      thresholdsListColors,
      timeFormat,
      tableOptions,
      fieldOptions,
      graphOptions,
      dashboardTemplates,
      onUpdateGraphOptions,
      onUpdateAxes,
      onUpdateDecimalPlaces,
      onUpdateGaugeColors,
      onUpdateThresholdsListColors,
      onUpdateThresholdsListType,
      onUpdateFieldOptions,
      onUpdateLineColors,
      onUpdateTableOptions,
      onUpdateTimeFormat,
    } = this.props

    const {defaultXLabel, defaultYLabel} = this.state

    switch (type) {
      case CellType.Gauge:
        return (
          <GaugeOptions
            onResetFocus={onResetFocus}
            axes={this.axes}
            decimalPlaces={decimalPlaces}
            gaugeColors={gaugeColors}
            onUpdateAxes={onUpdateAxes}
            onUpdateDecimalPlaces={onUpdateDecimalPlaces}
            onUpdateGaugeColors={onUpdateGaugeColors}
          />
        )
      case CellType.Note:
        return <NoteOptions />
      case CellType.SingleStat:
        return (
          <SingleStatOptions
            onResetFocus={onResetFocus}
            axes={this.axes}
            decimalPlaces={decimalPlaces}
            onUpdateAxes={onUpdateAxes}
            thresholdsListType={thresholdsListType}
            thresholdsListColors={thresholdsListColors}
            onUpdateDecimalPlaces={onUpdateDecimalPlaces}
            onUpdateThresholdsListType={onUpdateThresholdsListType}
            onUpdateThresholdsListColors={onUpdateThresholdsListColors}
          />
        )
      case CellType.Table:
        return (
          <TableOptions
            onResetFocus={onResetFocus}
            queryConfigs={queryConfigs}
            timeFormat={timeFormat}
            tableOptions={tableOptions}
            fieldOptions={fieldOptions}
            decimalPlaces={decimalPlaces}
            thresholdsListType={thresholdsListType}
            thresholdsListColors={thresholdsListColors}
            onUpdateDecimalPlaces={onUpdateDecimalPlaces}
            onUpdateFieldOptions={onUpdateFieldOptions}
            onUpdateTableOptions={onUpdateTableOptions}
            onUpdateTimeFormat={onUpdateTimeFormat}
            onUpdateThresholdsListColors={onUpdateThresholdsListColors}
            onUpdateThresholdsListType={onUpdateThresholdsListType}
          />
        )
      case CellType.StaticBar:
      case CellType.StaticStackedBar:
        return (
          <BarChartOptions
            axes={this.axes}
            fieldOptions={fieldOptions}
            groupByTag={this.groupByTag}
            tableOptions={tableOptions}
            type={type}
            lineColors={lineColors}
            graphOptions={graphOptions}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            defaultXLabel={defaultXLabel}
            defaultYLabel={defaultYLabel}
            dashboardTemplates={dashboardTemplates}
            onUpdateAxes={onUpdateAxes}
            onUpdateGraphOptions={onUpdateGraphOptions}
            onToggleStaticLegend={onToggleStaticLegend}
            onToggleStaticLegendPosition={onToggleStaticLegendPosition}
            onUpdateLineColors={onUpdateLineColors}
            onUpdateFieldOptions={onUpdateFieldOptions}
            onUpdateTableOptions={onUpdateTableOptions}
          />
        )
      case CellType.StaticPie:
      case CellType.StaticDoughnut:
        return (
          <DoughnutPieChartOptions
            axes={this.axes}
            fieldOptions={fieldOptions}
            groupByTag={this.groupByTag}
            tableOptions={tableOptions}
            type={type}
            lineColors={lineColors}
            graphOptions={graphOptions}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            defaultYLabel={defaultYLabel}
            dashboardTemplates={dashboardTemplates}
            onUpdateAxes={onUpdateAxes}
            onUpdateGraphOptions={onUpdateGraphOptions}
            onToggleStaticLegend={onToggleStaticLegend}
            onToggleStaticLegendPosition={onToggleStaticLegendPosition}
            onUpdateLineColors={onUpdateLineColors}
            onUpdateFieldOptions={onUpdateFieldOptions}
            onUpdateTableOptions={onUpdateTableOptions}
          />
        )
      case CellType.StaticLineChart:
        return (
          <LineChartOptions
            axes={this.axes}
            fieldOptions={fieldOptions}
            groupByTag={this.groupByTag}
            tableOptions={tableOptions}
            type={type}
            lineColors={lineColors}
            graphOptions={graphOptions}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            defaultXLabel={defaultXLabel}
            defaultYLabel={defaultYLabel}
            dashboardTemplates={dashboardTemplates}
            onUpdateAxes={onUpdateAxes}
            onUpdateGraphOptions={onUpdateGraphOptions}
            onToggleStaticLegend={onToggleStaticLegend}
            onToggleStaticLegendPosition={onToggleStaticLegendPosition}
            onUpdateLineColors={onUpdateLineColors}
            onUpdateFieldOptions={onUpdateFieldOptions}
            onUpdateTableOptions={onUpdateTableOptions}
          />
        )
      case CellType.StaticRadar:
        return (
          <RadarChartOptions
            axes={this.axes}
            type={type}
            lineColors={lineColors}
            graphOptions={graphOptions}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            dashboardTemplates={dashboardTemplates}
            onUpdateAxes={onUpdateAxes}
            onUpdateGraphOptions={onUpdateGraphOptions}
            onToggleStaticLegend={onToggleStaticLegend}
            onToggleStaticLegendPosition={onToggleStaticLegendPosition}
            onUpdateLineColors={onUpdateLineColors}
          />
        )
      case CellType.StaticScatter:
        return (
          <ScatterChartOptions
            axes={this.axes}
            type={type}
            lineColors={lineColors}
            graphOptions={graphOptions}
            staticLegend={staticLegend}
            staticLegendPosition={staticLegendPosition}
            dashboardTemplates={dashboardTemplates}
            defaultXLabel={defaultXLabel}
            defaultYLabel={defaultYLabel}
            onUpdateAxes={onUpdateAxes}
            onUpdateGraphOptions={onUpdateGraphOptions}
            onToggleStaticLegend={onToggleStaticLegend}
            onToggleStaticLegendPosition={onToggleStaticLegendPosition}
            onUpdateLineColors={onUpdateLineColors}
          />
        )
      default:
        return (
          <AxesOptions
            axes={this.axes}
            type={type}
            lineColors={lineColors}
            graphOptions={graphOptions}
            staticLegend={staticLegend}
            defaultYLabel={defaultYLabel}
            decimalPlaces={decimalPlaces}
            onUpdateAxes={onUpdateAxes}
            onUpdateGraphOptions={onUpdateGraphOptions}
            onToggleStaticLegend={onToggleStaticLegend}
            onUpdateLineColors={onUpdateLineColors}
            onUpdateDecimalPlaces={onUpdateDecimalPlaces}
          />
        )
    }
  }

  private get axes(): Axes {
    return this.props.axes || DEFAULT_AXES
  }

  private get groupByTag(): string[] {
    const {queryConfigs} = this.props

    if (queryConfigs.length) {
      return getGroupByTag(queryConfigs[0])
    }
    return []
  }

  private get defaultXLabel(): string {
    const {queryConfigs} = this.props
    if (queryConfigs.length) {
      return buildDefaultXLabel(queryConfigs[0])
    }

    return ''
  }

  private get defaultYLabel(): string {
    const {queryConfigs} = this.props
    if (queryConfigs.length) {
      return buildDefaultYLabel(queryConfigs[0])
    }

    return ''
  }
}

const ConnectedDisplayOptions = (props: PassedProps) => {
  // TODO: Have individual display option components subscribe directly to
  // relevant props, rather than passing them through here
  return (
    <TimeMachineContextConsumer>
      {(timeMachineContainer: TimeMachineContainer) => (
        <DisplayOptions
          {...props}
          type={timeMachineContainer.state.type}
          axes={timeMachineContainer.state.axes}
          tableOptions={timeMachineContainer.state.tableOptions}
          fieldOptions={timeMachineContainer.state.fieldOptions}
          timeFormat={timeMachineContainer.state.timeFormat}
          decimalPlaces={timeMachineContainer.state.decimalPlaces}
          note={timeMachineContainer.state.note}
          noteVisibility={timeMachineContainer.state.noteVisibility}
          thresholdsListColors={timeMachineContainer.state.thresholdsListColors}
          thresholdsListType={timeMachineContainer.state.thresholdsListType}
          gaugeColors={timeMachineContainer.state.gaugeColors}
          lineColors={timeMachineContainer.state.lineColors}
          graphOptions={timeMachineContainer.state.graphOptions}
          onUpdateGraphOptions={timeMachineContainer.handleUpdateGraphOptions}
          onUpdateType={timeMachineContainer.handleUpdateType}
          onUpdateAxes={timeMachineContainer.handleUpdateAxes}
          onUpdateTableOptions={timeMachineContainer.handleUpdateTableOptions}
          onUpdateFieldOptions={timeMachineContainer.handleUpdateFieldOptions}
          onUpdateTimeFormat={timeMachineContainer.handleUpdateTimeFormat}
          onUpdateDecimalPlaces={timeMachineContainer.handleUpdateDecimalPlaces}
          onUpdateNote={timeMachineContainer.handleUpdateNote}
          onUpdateNoteVisibility={
            timeMachineContainer.handleUpdateNoteVisibility
          }
          onUpdateThresholdsListColors={
            timeMachineContainer.handleUpdateThresholdsListColors
          }
          onUpdateThresholdsListType={
            timeMachineContainer.handleUpdateThresholdsListType
          }
          onUpdateGaugeColors={timeMachineContainer.handleUpdateGaugeColors}
          onUpdateLineColors={timeMachineContainer.handleUpdateLineColors}
        />
      )}
    </TimeMachineContextConsumer>
  )
}

export default ConnectedDisplayOptions
