import React, {useState} from 'react'
import {CellType, Template} from 'src/types'

interface CellListProps {
  onSelectionChange?: (items: {
    dashboards: any[]
    cellTypes: CellType[]
    templates: Template[]
  }) => void
}

const CELL_TYPE_INFO: Record<CellType, {name: string; description: string}> = {
  [CellType.Line]: {
    name: 'Line',
    description: 'Display time-series data as a line graph',
  },
  [CellType.Stacked]: {
    name: 'Stacked',
    description: 'Display multiple data series as stacked line graphs',
  },
  [CellType.StepPlot]: {
    name: 'Step Plot',
    description: 'Display data as a step plot line graph',
  },
  [CellType.Bar]: {
    name: 'Bar',
    description: 'Display data as a bar chart',
  },
  [CellType.LinePlusSingleStat]: {
    name: 'Line + Single Stat',
    description: 'Display a line graph with a single statistic',
  },
  [CellType.SingleStat]: {
    name: 'Single Stat',
    description: 'Display a single statistic value',
  },
  [CellType.Gauge]: {
    name: 'Gauge',
    description: 'Display data as a gauge chart',
  },
  [CellType.Table]: {
    name: 'Table',
    description: 'Display data in a table format',
  },
  [CellType.Alerts]: {
    name: 'Alerts',
    description: 'Display alert information',
  },
  [CellType.News]: {
    name: 'News',
    description: 'Display news information',
  },
  [CellType.Guide]: {
    name: 'Guide',
    description: 'Display guide information',
  },
  [CellType.Note]: {
    name: 'Note',
    description: 'Display note information',
  },
  [CellType.StaticBar]: {
    name: 'Static Bar',
    description: 'Display a static bar chart',
  },
  [CellType.StaticPie]: {
    name: 'Static Pie',
    description: 'Display a static pie chart',
  },
  [CellType.StaticDoughnut]: {
    name: 'Static Doughnut',
    description: 'Display a static doughnut chart',
  },
  [CellType.StaticScatter]: {
    name: 'Static Scatter',
    description: 'Display a static scatter plot',
  },
  [CellType.StaticRadar]: {
    name: 'Static Radar',
    description: 'Display a static radar chart',
  },
  [CellType.StaticStackedBar]: {
    name: 'Static Stacked Bar',
    description: 'Display a static stacked bar chart',
  },
  [CellType.StaticLineChart]: {
    name: 'Static Line Chart',
    description: 'Display a static line chart',
  },
  [CellType.StaticTableGaugeChart]: {
    name: 'Static Table Gauge',
    description: 'Display a static table gauge chart',
  },
}

function CellList({onSelectionChange}: CellListProps) {
  const [hoveredType, setHoveredType] = useState<CellType | null>(null)
  const [selectedCellTypes, setSelectedCellTypes] = useState<Set<CellType>>(new Set())

  const cellTypes = Object.values(CellType) as CellType[]

  const handleCellTypeToggle = (cellType: CellType, checked: boolean) => {
    const newSelected = new Set(selectedCellTypes)
    if (checked) {
      newSelected.add(cellType)
    } else {
      newSelected.delete(cellType)
    }
    setSelectedCellTypes(newSelected)

    if (onSelectionChange) {
      onSelectionChange({
        dashboards: [],
        cellTypes: Array.from(newSelected),
        templates: [],
      })
    }
  }

  return (
    <div style={{padding: '0 16px 16px 16px'}}>
      {cellTypes.map((cellType) => {
        const info = CELL_TYPE_INFO[cellType]
        const isHovered = hoveredType === cellType
        const isSelected = selectedCellTypes.has(cellType)

        return (
          <div
            key={cellType}
            onMouseEnter={() => setHoveredType(cellType)}
            onMouseLeave={() => setHoveredType(null)}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #383846',
              backgroundColor: isHovered ? '#31313d' : '#202028',
              transition: 'background-color 0.25s ease',
              cursor: 'pointer',
            }}
          >
            <div style={{display: 'flex', alignItems: 'flex-start', gap: '10px'}}>
              <div className="fixedmodal-checkbox-wrapper fixedmodal-checkbox-wrapper--cell-list">
                <input
                  type="checkbox"
                  id={`cell-type-checkbox-${cellType}`}
                  checked={isSelected}
                  onChange={e => {
                    e.stopPropagation()
                    handleCellTypeToggle(cellType, e.target.checked)
                  }}
                  onClick={e => e.stopPropagation()}
                />
                <label htmlFor={`cell-type-checkbox-${cellType}`} />
              </div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#383846',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{color: '#999dab', fontSize: '12px'}}>Icon</span>
              </div>

              <div style={{flex: 1, minWidth: 0}}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: '14px',
                    color: isHovered ? '#f6f6f8' : '#d4d7dd',
                    marginBottom: '4px',
                    transition: 'color 0.25s ease',
                  }}
                >
                  {info.name}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: isHovered ? '#d4d7dd' : '#999dab',
                    lineHeight: '1.4',
                    transition: 'color 0.25s ease',
                  }}
                >
                  {info.description}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CellList
