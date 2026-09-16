import {
  switchPortColumns,
  switchPortDeviceColumns,
} from 'src/device_management/constants/switchPortColumns'

// TableBase drops the accordion column from the table it draws.
const rendered = () =>
  switchPortDeviceColumns.filter(column => !column.options?.isAccordion)

const widthOf = (key: string): string | undefined =>
  rendered().find(c => c.key === key)?.options?.thead?.style?.width as string

describe('device_management/constants/switchPortColumns', () => {
  it('gives every rendered device column a percentage width', () => {
    rendered().forEach(column => {
      expect(widthOf(column.key)).toMatch(/^\d+%$/)
    })
  })

  it('adds the widths up to the full table', () => {
    const total = rendered().reduce(
      (sum, column) => sum + parseInt(widthOf(column.key), 10),
      0
    )
    expect(total).toBe(100)
  })

  it('nests the ports under the device row', () => {
    expect(switchPortDeviceColumns.find(c => c.options?.isAccordion)?.key).toBe(
      'ports'
    )
  })

  it('shows the port facts an operator checks', () => {
    expect(switchPortColumns.map(c => c.key)).toEqual([
      'ifName',
      'alias',
      'admin',
      'oper',
      'status',
      'sinceChangeTicks',
    ])
  })
})
