import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'
import {TEMP_VAR_DASHBOARD_TIME} from 'src/shared/constants'
import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants/index'
import {DEFAULT_AXIS} from 'src/dashboards/constants/cellEditor'
import {Source, Cell, CellQuery, Axes, CellType, QueryType} from 'src/types'

const emptyQuery: CellQuery = {
  query: '',
  source: '',
  queryConfig: {
    database: '',
    measurement: '',
    retentionPolicy: '',
    fields: [],
    tags: {},
    groupBy: {},
    areTagsAccepted: false,
    rawText: null,
    range: null,
  },
  type: QueryType.InfluxQL,
}

const emptyAxes: Axes = {
  x: DEFAULT_AXIS,
  y: DEFAULT_AXIS,
}

export const fixtureStatusPageCells = (source: Source): Cell[] => {
  return [
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      axes: emptyAxes,
      i: 'alerts-bar-graph',
      type: CellType.Bar,
      isWidget: false,
      x: 0,
      y: 0,
      w: 96,
      h: 4,
      minH: 0,
      legend: {},
      name: 'Alert Events per Day – Last 30 Days',
      colors: DEFAULT_LINE_COLORS,
      queries: [
        {
          id: '1234',
          query: `SELECT count("value") AS "count_value" FROM "cloudhub_alerts" WHERE time > ${TEMP_VAR_DASHBOARD_TIME} GROUP BY time(1d)`,
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
      axes: emptyAxes,
      i: 'recent-alerts',
      type: CellType.Alerts,
      isWidget: true,
      name: 'Alerts – Last 30 Days',
      x: 0,
      y: 5,
      w: 52,
      h: 6,
      minH: 0,
      legend: {},
      queries: [emptyQuery],
      colors: DEFAULT_LINE_COLORS,
      links: {self: ''},
    },
    // {
    //   ...NEW_DEFAULT_DASHBOARD_CELL,
    //   axes: emptyAxes,
    //   i: 'news-feed',
    //   type: CellType.News,
    //   isWidget: true,
    //   name: 'News Feed',
    //   x: 6.5,
    //   y: 5,
    //   w: 3,
    //   h: 6,
    //   legend: {},
    //   queries: [emptyQuery],
    //   colors: DEFAULT_LINE_COLORS,
    //   links: {self: ''},
    // },
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      axes: emptyAxes,
      i: 'getting-started',
      type: CellType.Guide,
      isWidget: true,
      name: 'Getting Started',
      x: 52,
      y: 5,
      w: 44,
      h: 6,
      minH: 0,
      legend: {},
      queries: [emptyQuery],
      colors: DEFAULT_LINE_COLORS,
      links: {self: ''},
    },
  ]
}
