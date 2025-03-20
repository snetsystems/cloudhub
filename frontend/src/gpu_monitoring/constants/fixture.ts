// Constants
import {DEFAULT_AXIS} from 'src/dashboards/constants/cellEditor'
import {NEW_DEFAULT_DASHBOARD_CELL} from 'src/dashboards/constants/index'
import {DEFAULT_LINE_COLORS} from 'src/shared/constants/graphColorPalettes'

// Type
import {Cell, Axes, CellType, Source} from 'src/types'

const emptyAxes: Axes = {
  x: DEFAULT_AXIS,
  y: DEFAULT_AXIS,
}

export const FIXTURE_GPU_MONITORING_CELLS = (source: Source): Cell[] => {
  return [
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'gpu-monitoring',
      x: 0,
      y: 0,
      w: 65,
      h: 30,
      minH: 15,
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
      h: 30,
      minW: 10,
      minH: 30,
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
      y: 31,
      w: 50,
      h: 40,
      minW: 20,
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
  ]
}
