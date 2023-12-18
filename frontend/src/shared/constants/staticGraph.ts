export const CHART_GRID_COLOR = '#383846'
export const CHART_TITLE_COLOR = '#999dab'
export const CHART_TITLE_FONT_SIZE = 11
export const CHART_TITLE_FONT_WEIGHT = '600'
export const CHART_LABEL_FONT_SIZE = 11
export const CHART_LABEL_FONT_WEIGHT = '600'
export const LEGEND_FONT_SIZE_FONT_FAMILY = '11px Roboto'
export const LEGEND_MIN_MARGIN_WIDTH = 30
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
    tooltip: {
      pointStyle: 'circle',
      usePointStyle: true,
      boxWidth: 8,
      boxHeight: 8,
      animation: false as any,
      callbacks: {
        labelPointStyle: function () {
          return {
            pointStyle: 'circle' as const,
            rotation: 0,
          }
        },
      },
    },
    legend: {
      display: false,
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

export const LEGEND_POSITION = {
  right: {
    container: {flexDirection: 'row' as const},

    legend: {
      container: {
        maxHeight: '100%',
        minWidth: 'auto',
        maxWidth: '120px',
      },
      item: {},
    },
  },
  left: {
    container: {
      flexDirection: 'row-reverse' as const,
    },

    legend: {
      container: {
        maxHeight: '100%',
        minWidth: 'auto',
        maxWidth: '120px',
      },
      item: {},
    },
  },
  top: {
    container: {
      flexDirection: 'column-reverse' as const,
      alignItems: 'start',
    },

    legend: {
      container: {
        maxHeight: '50%',
        minWidth: '100px',
        overflowX: 'hidden' as const,
      },
      item: {},
    },
  },
  bottom: {
    container: {
      flexDirection: 'column' as const,
      alignItems: 'start',
    },

    legend: {
      container: {
        maxHeight: '50%',
        minWidth: '100px',
        overflowX: 'hidden' as const,
      },
      item: {},
    },
  },
}
