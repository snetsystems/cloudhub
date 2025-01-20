// Constants
import {DEFAULT_AXIS} from 'src/dashboards/constants/cellEditor'
import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants/index'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'

// Type
import {Cell, Axes, CellType, Source, QueryType} from 'src/types'

const emptyAxes: Axes = {
  x: DEFAULT_AXIS,
  y: DEFAULT_AXIS,
}

export const fixturePredictionPageCells = (source: Source): Cell[] => {
  return [
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
      x: 53,
      y: 0,
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
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'history',
      x: 0,
      y: 0,
      w: 53,
      h: 24,
      minW: 30,
      minH: 13,
      name: '',
      queries: [],
      type: CellType.Table,
      axes: emptyAxes,
      colors: DEFAULT_LINE_COLORS,
      legend: {},
      timeFormat: '',
      note: '',
      links: {
        self: '/cloudhub/v1/status/23/cells/c-bar-graphs-fly',
      },
    },
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'polygon',
      x: 0,
      y: 24,
      w: 29,
      h: 28,
      minH: 12,
      minW: 20,
      name: '',
      queries: [],
      type: CellType.Table,
      axes: emptyAxes,
      colors: DEFAULT_LINE_COLORS,
      legend: {},
      timeFormat: '',
      note: '',
      links: {
        self: '/cloudhub/v1/status/23/cells/c-bar-graphs-fly',
      },
    },
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'instanceGraph',
      x: 29,
      y: 24,
      w: 67,
      h: 28,
      minH: 10,
      name: '',
      queries: [],
      type: CellType.Table,
      axes: emptyAxes,
      colors: DEFAULT_LINE_COLORS,
      legend: {},
      timeFormat: '',
      note: '',
      links: {
        self: '/cloudhub/v1/status/23/cells/c-bar-graphs-fly',
      },
    },
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'staticGraph',
      x: 0,
      y: 52,
      w: 100,
      h: 55,
      minW: 30,
      minH: 55,
      name: '',
      queries: [],
      type: CellType.Table,
      axes: emptyAxes,
      colors: DEFAULT_LINE_COLORS,
      legend: {},
      timeFormat: '',
      note: '',
      links: {
        self: '/cloudhub/v1/status/23/cells/c-bar-graphs-fly',
      },
    },
  ]
}
