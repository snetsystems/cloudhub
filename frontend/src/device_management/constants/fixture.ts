import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants/index'
import {DEFAULT_AXIS} from 'src/dashboards/constants/cellEditor'
import {Cell, CellQuery, Axes, CellType, QueryType, Source} from 'src/types'
import {
  TEMP_VAR_DASHBOARD_TIME,
  TEMP_VAR_UPPER_DASHBOARD_TIME,
} from 'src/shared/constants'

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
      x: 0,
      y: 0,
      w: 96,
      h: 10,
      minH: 10,
      legend: {},
      name: 'Alert Events',
      colors: DEFAULT_LINE_COLORS,
      queries: [
        {
          id: '1234',
          query: `SELECT count("value") AS "count_value" FROM "cloudhub_alerts" WHERE time > '${TEMP_VAR_DASHBOARD_TIME}' time < '${TEMP_VAR_UPPER_DASHBOARD_TIME}' GROUP BY time(1d)`,
          source: '',
          type: QueryType.InfluxQL,
          queryConfig: {
            database: source.telegraf,
            measurement: 'cloudhub_alerts',
            retentionPolicy: 'autogen',
            fields: [
              {
                value: 'count',
                type: 'func',
                alias: 'count_value',
                args: [
                  {
                    value: 'value',
                    type: 'field',
                  },
                ],
              },
            ],
            tags: {},
            groupBy: {
              time: '1d',
              tags: [],
            },
            areTagsAccepted: false,
            rawText: null,
            range: null,
          },
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
      y: 10,
      w: 96,
      h: 12,
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
      i: 'polygon',
      x: 0,
      y: 22,
      w: 96,
      h: 10,
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
      i: 'instanceGraph',
      x: 0,
      y: 32,
      w: 96,
      h: 30,
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
  ]
}
