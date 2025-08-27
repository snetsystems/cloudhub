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

export const FIXTURE_KUBERNETES_POWERFLEX_CELLS = (): Cell[] => {
  return [
    {
      ...NEW_DEFAULT_DASHBOARD_CELL,
      i: 'kubernetes-powerflex-metrics-chart',
      x: 0,
      y: 0,
      w: 96,
      h: 17,
      minW: 12,
      minH: 17,
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
