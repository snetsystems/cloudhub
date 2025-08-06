export const HistogramOptions = ({
  setTimeRange,
  setActive,
  setDragEndTime,
}: {
  setTimeRange: (timeRange: {gte: number; lte: number}) => void
  setActive: (indices: number[]) => void
  setDragEndTime: (dragEndTime: number) => void
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
      tooltip: {
        borderWidth: 0,
        cornerRadius: 4,
        pointStyle: 'circle',
        usePointStyle: true,
        boxWidth: 10,
        boxHeight: 10,
        callbacks: {},
      },
      legend: {
        display: false,
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
        stacked: false,
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
        stacked: false,
      },
    },
  }
}
