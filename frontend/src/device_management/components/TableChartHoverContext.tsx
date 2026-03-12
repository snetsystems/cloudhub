import React, {createContext, useContext, useMemo, useState} from 'react'
import {TimeSeriesValue} from 'src/types/series'

export interface TableChartHoverPayload {
  cellId: string
  time: TimeSeriesValue
  cursorX: number
  cursorY: number
}

interface TableChartHoverState {
  activeCellId: string | null
  hoveredTime: TimeSeriesValue
  hoveredTimeKey: string | null
  cursorX: number
  cursorY: number
  enabled: boolean
  setHover: (payload: TableChartHoverPayload) => void
  clearHover: (cellId?: string) => void
}

interface TableChartCellState {
  cellId: string
}

const defaultHoverState: TableChartHoverState = {
  activeCellId: null,
  hoveredTime: null,
  hoveredTimeKey: null,
  cursorX: 0,
  cursorY: 0,
  enabled: false,
  setHover: () => {},
  clearHover: () => {},
}

const TableChartHoverContext = createContext<TableChartHoverState>(
  defaultHoverState
)
const TableChartCellContext = createContext<TableChartCellState | null>(null)

export const normalizeTableHoverTime = (time: TimeSeriesValue): string | null =>
  time === null || time === undefined ? null : String(time)

interface ProviderProps {
  children: React.ReactNode
}

export const TableChartHoverProvider = ({children}: ProviderProps) => {
  const [hoverState, setHoverState] = useState<{
    activeCellId: string | null
    hoveredTime: TimeSeriesValue
    hoveredTimeKey: string | null
    cursorX: number
    cursorY: number
  }>({
    activeCellId: null,
    hoveredTime: null,
    hoveredTimeKey: null,
    cursorX: 0,
    cursorY: 0,
  })

  const value = useMemo<TableChartHoverState>(
    () => ({
      ...hoverState,
      enabled: true,
      setHover: payload => {
        setHoverState({
          activeCellId: payload.cellId,
          hoveredTime: payload.time ?? null,
          hoveredTimeKey: normalizeTableHoverTime(payload.time),
          cursorX: payload.cursorX,
          cursorY: payload.cursorY,
        })
      },
      clearHover: cellId => {
        setHoverState(current => {
          if (cellId && current.activeCellId && current.activeCellId !== cellId) {
            return current
          }

          return {
            activeCellId: null,
            hoveredTime: null,
            hoveredTimeKey: null,
            cursorX: 0,
            cursorY: 0,
          }
        })
      },
    }),
    [hoverState]
  )

  return (
    <TableChartHoverContext.Provider value={value}>
      {children}
    </TableChartHoverContext.Provider>
  )
}

interface CellProviderProps {
  children: React.ReactNode
  value: TableChartCellState
}

export const TableChartCellProvider = ({
  children,
  value,
}: CellProviderProps) => {
  return (
    <TableChartCellContext.Provider value={value}>
      {children}
    </TableChartCellContext.Provider>
  )
}

export const useTableChartHover = () => useContext(TableChartHoverContext)

export const useTableChartCell = () => useContext(TableChartCellContext)
