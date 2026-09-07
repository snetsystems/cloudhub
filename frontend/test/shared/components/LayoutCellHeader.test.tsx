// cellGetters pulls in the worker JobManager (import.meta), which ts-jest
// cannot compile to CommonJS; only isCellUntitled is needed here.
jest.mock('src/dashboards/utils/cellGetters', () => ({
  __esModule: true,
  isCellUntitled: (name: string) => name === 'Untitled Graph',
}))

import React from 'react'
import {mount} from 'enzyme'

import LayoutCellHeader from 'src/shared/components/LayoutCellHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'

const setup = (overrides = {}) =>
  mount(
    <LayoutCellHeader
      cellName="Optical Transceiver (SFP)"
      isEditable={true}
      makeSpaceForCellNote={false}
      cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
      cellTextColor={DEFAULT_CELL_TEXT_COLOR}
      {...overrides}
    />
  )

const startEditing = (wrapper: any) =>
  wrapper.find('.dash-graph--name').simulate('click')

describe('shared/components/LayoutCellHeader', () => {
  it('stays read-only without an onRename handler', () => {
    const wrapper = setup()

    startEditing(wrapper)

    expect(wrapper.find('input.dash-graph--name-input').exists()).toBe(false)
  })

  it('stays read-only on a layout that is not editable', () => {
    const wrapper = setup({isEditable: false, onRename: jest.fn()})

    startEditing(wrapper)

    expect(wrapper.find('input.dash-graph--name-input').exists()).toBe(false)
  })

  it('opens an input seeded with the current name', () => {
    const wrapper = setup({onRename: jest.fn()})

    startEditing(wrapper)

    expect(wrapper.find('input.dash-graph--name-input').prop('value')).toBe(
      'Optical Transceiver (SFP)'
    )
  })

  it('commits the new name on Enter', () => {
    const onRename = jest.fn()
    const wrapper = setup({onRename})

    startEditing(wrapper)
    wrapper
      .find('input.dash-graph--name-input')
      .simulate('change', {target: {value: '광 트랜시버'}})
    wrapper
      .find('input.dash-graph--name-input')
      .simulate('keydown', {key: 'Enter'})

    expect(onRename).toHaveBeenCalledWith('광 트랜시버')
    expect(wrapper.find('input.dash-graph--name-input').exists()).toBe(false)
  })

  it('commits on blur', () => {
    const onRename = jest.fn()
    const wrapper = setup({onRename})

    startEditing(wrapper)
    wrapper
      .find('input.dash-graph--name-input')
      .simulate('change', {target: {value: 'SFP'}})
    wrapper.find('input.dash-graph--name-input').simulate('blur')

    expect(onRename).toHaveBeenCalledWith('SFP')
  })

  it('discards the edit on Escape', () => {
    const onRename = jest.fn()
    const wrapper = setup({onRename})

    startEditing(wrapper)
    wrapper
      .find('input.dash-graph--name-input')
      .simulate('change', {target: {value: 'thrown away'}})
    wrapper
      .find('input.dash-graph--name-input')
      .simulate('keydown', {key: 'Escape'})

    expect(onRename).not.toHaveBeenCalled()
    expect(wrapper.find('.dash-graph--name').text()).toBe(
      'Optical Transceiver (SFP)'
    )
  })

  it('ignores an empty name rather than leaving the cell unlabelled', () => {
    const onRename = jest.fn()
    const wrapper = setup({onRename})

    startEditing(wrapper)
    wrapper
      .find('input.dash-graph--name-input')
      .simulate('change', {target: {value: '   '}})
    wrapper.find('input.dash-graph--name-input').simulate('blur')

    expect(onRename).not.toHaveBeenCalled()
  })

  it('does not save when the name is unchanged', () => {
    const onRename = jest.fn()
    const wrapper = setup({onRename})

    startEditing(wrapper)
    wrapper.find('input.dash-graph--name-input').simulate('blur')

    expect(onRename).not.toHaveBeenCalled()
  })
})
