// Constants
import {DEFAULT_AXIS} from 'src/dashboards/constants/cellEditor'
import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants/index'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'

// Type
import {Cell, Axes, CellType, QueryType, Source} from 'src/types'

const emptyAxes: Axes = {
  x: DEFAULT_AXIS,
  y: DEFAULT_AXIS,
}

export const FIXTURE_LOG_ANALYSIS_CELLS = (source: Source): Cell[] => {
  return [
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'log-analysis-treemap',
      x: 0,
      y: 0,
      w: 65,
      h: 24,
      minH: 14,
      minW: 13,
      name: '',
      queries: [],
      type: CellType.Table,
      axes: emptyAxes,
      colors: DEFAULT_LINE_COLORS,
      legend: {},
      timeFormat: '',
      note: '',
      links: {
        self: '',
      },
    },
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'log-analysis-syslog-table',
      x: 0,
      y: 24,
      w: 96,
      h: 34,
      minW: 48,
      minH: 34,
      name: '',
      queries: [],
      type: CellType.Table,
      axes: emptyAxes,
      colors: DEFAULT_LINE_COLORS,
      legend: {},
      timeFormat: '',
      note: '',
      links: {
        self: '',
      },
    },
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      graphOptions: {
        fillArea: true,
        showLine: true,
        showPoint: false,
        showTempVarCount: '',
      },
      axes: emptyAxes,
      i: 'alerts-bar-graph',
      type: CellType.Bar,
      isWidget: false,
      x: 0,
      y: 58,
      w: 43,
      h: 24,
      minH: 10,
      legend: {},
      name: 'Alert Events',
      colors: DEFAULT_LINE_COLORS,
      queries: [
        {
          query: `SELECT count("value") AS "count_value" FROM "${source.telegraf}"."autogen"."cloudhub_alerts"`,
          queryConfig: null,
          source: '',
          type: QueryType.InfluxQL,
        },
      ],
      links: {
        self: '/cloudhub/v1/status/23/cells/c-bar-graphs-fly',
      },
    },
  ]
}
