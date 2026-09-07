jest.mock('src/device_management/components/OpticsCellContent', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('src/shared/components/LayoutRenderer', () => ({
  __esModule: true,
  default: () => null,
}))

import React from 'react'
import {mount} from 'enzyme'

import PreviewCellCard from 'src/reusable_ui/components/FixedModal/PreviewCellCard'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import {renderRegisteredCell} from 'src/shared/components/cellRegistry'
import {previewCardHeight} from 'src/reusable_ui/components/FixedModal/previewCells'
import {Cell, Source} from 'src/types'

// PreviewCellCard renders the graph only once its card is on screen.
class ImmediateIntersectionObserver {
  constructor(callback: (entries: Array<{isIntersecting: boolean}>) => void) {
    this.callback = callback
  }
  private callback: (entries: Array<{isIntersecting: boolean}>) => void
  public observe() {
    this.callback([{isIntersecting: true}])
  }
  public disconnect() {}
}

beforeAll(() => {
  ;(window as any).IntersectionObserver = ImmediateIntersectionObserver
})

const source = {id: '1', links: {proxy: '/proxy'}} as Source
const componentCell = {
  i: 'snmp-optics',
  name: 'Optical Transceiver (SFP)',
  type: 'component',
  h: 30,
  queries: [],
} as Cell

describe('reusable_ui/components/FixedModal/PreviewCellCard', () => {
  it('renders component cells through the cell registry', () => {
    const wrapper = mount(
      <PreviewCellCard cell={componentCell} source={source} />
    )

    expect(wrapper.find(LayoutRenderer).prop('renderCell')).toBe(
      renderRegisteredCell
    )
  })

  it('sizes the card from the cell height so tall cells are not clipped', () => {
    const wrapper = mount(
      <PreviewCellCard cell={componentCell} source={source} />
    )

    expect(
      wrapper.find('.import-selection-preview-card__body').prop('style')
    ).toEqual({height: 420})
  })
})

describe('previewCardHeight', () => {
  it('keeps the previous card size for ordinary graph cells', () => {
    expect(previewCardHeight({h: 4} as Cell)).toBe(220)
  })

  it('grows with the cell height', () => {
    expect(previewCardHeight({h: 30} as Cell)).toBe(420)
  })

  it('caps very tall cells', () => {
    expect(previewCardHeight({h: 100} as Cell)).toBe(440)
  })

  it('falls back when the cell has no height', () => {
    expect(previewCardHeight({} as Cell)).toBe(220)
  })
})
