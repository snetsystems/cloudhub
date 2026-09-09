import {opticsDeviceColumns} from 'src/device_management/constants/opticsColumns'
import {DEFAULT_OPTICS_THRESHOLD} from 'src/device_management/constants/opticsThreshold'

// TableBase drops the accordion column from the table it draws, so it is not
// part of the width budget.
const columns = () =>
  opticsDeviceColumns(false, DEFAULT_OPTICS_THRESHOLD).filter(
    column => !column.options?.isAccordion
  )

const widthOf = (key: string): string | undefined => {
  const column = columns().find(c => c.key === key)
  return column?.options?.thead?.style?.width as string | undefined
}

describe('device_management/constants/opticsColumns', () => {
  // Nothing else decides the split: the table lays out auto, so a column left
  // without a width is sized by the browser off its content.
  it('gives every rendered column a percentage width', () => {
    columns().forEach(column => {
      expect(widthOf(column.key)).toMatch(/^\d+%$/)
    })
  })

  // Percentages only hold the intended split if they account for the whole
  // table; a short total lets the browser hand the remainder out on its own.
  it('adds the widths up to the full table', () => {
    const total = columns().reduce(
      (sum, column) => sum + parseInt(widthOf(column.key), 10),
      0
    )

    expect(total).toBe(100)
  })

  // The three gauges are the reason the cell exists, so they get the room and
  // the two ratios beside them get as little as their headings need.
  it('gives the metric columns more room than the port ratios', () => {
    expect(widthOf('tx')).toBe('16%')
    expect(widthOf('rx')).toBe('16%')
    expect(widthOf('temp')).toBe('16%')
    expect(widthOf('status')).toBe('5%')
    expect(widthOf('slots')).toBe('5%')
  })
})
