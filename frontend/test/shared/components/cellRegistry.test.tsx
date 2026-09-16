jest.mock('src/device_management/components/OpticsCellContent', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('src/device_management/components/SwitchPortsCellContent', () => ({
  __esModule: true,
  default: () => null,
}))

import {renderRegisteredCell} from 'src/shared/components/cellRegistry'
import OpticsCellContent from 'src/device_management/components/OpticsCellContent'
import SwitchPortsCellContent from 'src/device_management/components/SwitchPortsCellContent'
import type {RenderCellContext} from 'src/shared/components/LayoutRenderer'
import * as DashboardsModels from 'src/types/dashboards'

const cell = (i?: string) => ({i} as DashboardsModels.Cell)
const context = {} as RenderCellContext

describe('shared/components/cellRegistry', () => {
  it('renders the registered component for a builtin cell id', () => {
    expect(renderRegisteredCell(cell('snmp-optics'), context).type).toBe(
      OpticsCellContent
    )
  })

  it('renders the registered component for an imported copy of the cell', () => {
    const imported = cell('snmp-optics-import-1700000000000-abc123def')
    expect(renderRegisteredCell(imported, context).type).toBe(OpticsCellContent)
  })

  it('renders the switch ports component for its builtin cell id', () => {
    expect(renderRegisteredCell(cell('snmp-ports'), context).type).toBe(
      SwitchPortsCellContent
    )
  })

  it('returns null for an unregistered cell id', () => {
    expect(renderRegisteredCell(cell('some-graph-cell'), context)).toBeNull()
  })

  it('returns null for a cell without an id', () => {
    expect(renderRegisteredCell(cell(), context)).toBeNull()
  })
})
