// Constants
import {DEFAULT_AXIS} from 'src/dashboards/constants/cellEditor'
import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants/index'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'

// Type
import {Cell, Axes, CellType} from 'src/types'

const emptyAxes: Axes = {
  x: DEFAULT_AXIS,
  y: DEFAULT_AXIS,
}

export const FIXTURE_GPU_MONITORING_CELLS = (): Cell[] => {
  return [
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'gpu-monitoring',
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
      i: 'gpu-monitoring-details',
      x: 65,
      y: 0,
      w: 31,
      h: 24,
      minW: 10,
      minH: 14,
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
      i: 'gpu-time-series',
      x: 0,
      y: 24,
      w: 48,
      h: 40,
      minW: 30,
      minH: 40,
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
      i: 'gpu-statistics',
      x: 48,
      y: 24,
      w: 48,
      h: 52,
      minW: 30,
      minH: 52,
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
  ]
}
