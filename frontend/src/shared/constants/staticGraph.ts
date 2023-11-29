import {LINE_COLORS} from 'src/shared/graphs/helpers'

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
      align: 'start' as const,
      font: {
        size: 11,
      },
    },
  },

  scales: {
    x: {
      barThickness: 1,
      grid: {
        color: '#383846',
      },
      ticks: {
        font: {
          size: 11,
        },
      },
    },
    y: {
      grid: {
        color: '#383846',
      },
    },
  },
}
