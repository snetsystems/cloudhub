import {SeverityColorValues} from 'src/logs/constants'
import {SeverityLevelColor} from 'src/types/logs'

export const HistogramOptions = ({
  setTimeRange,
  setActive,
  setDragEndTime,
  severityLevelColors,
}: {
  setTimeRange: (timeRange: {gte: number; lte: number}) => void
  setActive: (indices: number[]) => void
  setDragEndTime: (dragEndTime: number) => void
  severityLevelColors: SeverityLevelColor[]
}) => {
  return {
    layout: {
      padding: {
        right: 10,
      },
    },
    animation: {
      duration: 0,
    },
    maintainAspectRatio: false,
    responsive: true,
    interaction: {mode: 'index' as const, intersect: false},
    plugins: {
      'stable-selection': {
        threshold: 8,
        onSelect: ({gte, lte, indices}) => {
          if (gte >= 0 && lte >= 0) {
            setTimeRange({gte, lte})
            setActive(indices)
          }
        },

        onDragEnd: () => {
          setDragEndTime(Date.now())
        },
      },
      zoom: {
        zoom: {
          drag: {
            enabled: false,
          },
          wheel: {
            enabled: false,
          },
          pinch: {
            enabled: true,
          },

          mode: 'x' as const,
        },
      },
      legend: {
        display: false,
      },
      tooltip: {
        borderWidth: 0,
        cornerRadius: 4,
        pointStyle: 'circle',
        usePointStyle: true,
        boxWidth: 10,
        boxHeight: 10,
        displayColors: true,
        padding: {top: 12, right: 12, bottom: 12, left: 12},
        footerMarginTop: 8,
        filter: item => (item.parsed.y ?? 0) > 0,
        footerFont: {weight: '600'},
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y ?? 0
            return `${ctx.dataset.label}: ${v.toLocaleString()}`
          },

          labelTextColor: ctx => {
            return SeverityColorValues[
              severityLevelColors.find(i => i.level == ctx.dataset.label).color
            ]
          },

          labelColor: ctx => {
            const bg =
              SeverityColorValues[
                severityLevelColors.find(i => i.level == ctx.dataset.label)
                  .color
              ]

            return {
              backgroundColor: bg,
              borderColor: '#707280',
            }
          },

          footer: ctx => {
            if (!ctx.length) return ''

            const chart = ctx[0].chart
            const i = ctx[0].dataIndex

            const totalAll = chart.data.datasets
              .filter((ds: any) => ds.stack === 'sev')
              .reduce(
                (sum, ds: any) => sum + (Number((ds.data as number[])[i]) || 0),
                0
              )

            return `Total: ${totalAll.toLocaleString()}`
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          color: '#999dab',
          display: true,
          font: {
            size: 11,
            weight: '600',
          },
          padding: {
            top: 15,
            left: 0,
            right: 0,
            bottom: 0,
          },
          text: 'Time',
        },

        barThickness: 1,
        grid: {
          color: '#383846',
        },
        ticks: {
          font: {
            size: 11,
            weight: '600',
          },
          maxRotation: 0,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
          autoSkipPadding: 25,
          sampleSize: 8,
        },
        stacked: true,
      },
      y: {
        title: {
          color: '#999dab',
          display: true,
          font: {
            size: 11,
            weight: '600',
          },

          position: 'left',
          text: 'Log Count',
        },
        grid: {
          color: '#383846',
        },
        ticks: {
          font: {
            size: 11,
            weight: '600',
          },
        },
        stacked: true,
      },
    },
  }
}
