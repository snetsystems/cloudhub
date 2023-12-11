import {LINE_COLORS} from 'src/shared/graphs/helpers'

const CHART_GRID_COLOR = '#383846'
const CHART_TITLE_COLOR = '#999dab'
const CHART_TITLE_FONT_SIZE = 11
const CHART_TITLE_FONT_WEIGHT = '600'
const CHART_LABEL_FONT_SIZE = 11
const CHART_LABEL_FONT_WEIGHT = '600'

export const STATIC_GRAPH_OPTIONS = {
  layout: {
    padding: {
      right: 10,
    },
  },
  animation: {
    duration: 500,
  },
  maintainAspectRatio: false,
  responsive: true,
  plugins: {
    zoom: {
      zoom: {
        drag: {
          enabled: true,
        },
        wheel: {
          enabled: true,
        },
        pinch: {
          enabled: true,
        },
        mode: 'x' as const,
      },
    },

    colorschemes: {
      scheme: LINE_COLORS,
    },

    legend: {
      display: true,
    },
  },

  scales: {
    x: {
      title: {
        color: CHART_TITLE_COLOR,
        display: true,
        font: {
          size: CHART_TITLE_FONT_SIZE,
          weight: CHART_TITLE_FONT_WEIGHT,
        },
        padding: {top: 15, left: 0, right: 0, bottom: 0},
        text: 'X-Axis Title',
      },
      barThickness: 1,
      grid: {
        color: CHART_GRID_COLOR,
      },
      ticks: {
        font: {
          size: CHART_LABEL_FONT_SIZE,
          weight: CHART_LABEL_FONT_WEIGHT,
        },
      },
    },
    y: {
      title: {
        color: CHART_TITLE_COLOR,
        display: true,
        font: {
          size: CHART_TITLE_FONT_SIZE,
          weight: CHART_TITLE_FONT_WEIGHT,
        },
        padding: {top: 0, left: 0, right: 0, bottom: 15},
        position: 'left' as const,
        text: 'Y-Axis Title',
      },
      grid: {
        color: CHART_GRID_COLOR,
      },
      ticks: {
        font: {
          size: CHART_LABEL_FONT_SIZE,
          weight: CHART_LABEL_FONT_WEIGHT,
        },
      },
    },
  },
}
