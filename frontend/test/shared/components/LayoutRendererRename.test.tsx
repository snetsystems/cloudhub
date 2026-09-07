// The worker manager uses import.meta, which ts-jest cannot emit for CommonJS.
jest.mock('src/worker/JobManager', () => ({
  __esModule: true,
  manager: {},
}))

import React from 'react'
import {shallow} from 'enzyme'

import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {Cell, Source, TimeRange} from 'src/types'

const cells = [
  {i: 'snmp-optics', name: 'Optical Transceiver (SFP)', x: 0, y: 0, w: 96, h: 30},
  {i: 'other-cell', name: 'CPU Usage', x: 0, y: 30, w: 48, h: 4},
] as Cell[]

const source = {id: '1', links: {proxy: '/proxy'}} as Source
const timeRange: TimeRange = {lower: 'now() - 15m', upper: null}

const setup = (overrides = {}) => {
  const renderCell = jest.fn().mockReturnValue(null)

  shallow(
    <LayoutRenderer
      cells={cells}
      source={source}
      sources={[source]}
      host=""
      templates={[]}
      timeRange={timeRange}
      manualRefresh={0}
      isStatusPage={false}
      isStaticPage={false}
      isEditable={true}
      renderCell={renderCell}
      {...overrides}
    />
  )

  return renderCell
}

const contextOf = (renderCell: jest.Mock) => renderCell.mock.calls[0][1]

describe('shared/components/LayoutRenderer rename wiring', () => {
  it('renames through the layout save the dashboard already provides', () => {
    const onPositionChange = jest.fn()
    const renderCell = setup({onPositionChange})

    contextOf(renderCell).onRenameCell(cells[0], '광 트랜시버')

    expect(onPositionChange).toHaveBeenCalledWith([
      {...cells[0], name: '광 트랜시버'},
      cells[1],
    ])
  })

  it('leaves the rest of the layout untouched', () => {
    const onPositionChange = jest.fn()
    const renderCell = setup({onPositionChange})

    contextOf(renderCell).onRenameCell(cells[1], 'CPU')

    const [saved] = onPositionChange.mock.calls[0]
    expect(saved[0]).toBe(cells[0])
    expect(saved[1].name).toBe('CPU')
  })

  it('offers no rename on a read-only layout', () => {
    const renderCell = setup()

    expect(contextOf(renderCell).onRenameCell).toBeUndefined()
  })
})
