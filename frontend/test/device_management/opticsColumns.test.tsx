import {opticsDeviceColumns} from 'src/device_management/constants/opticsColumns'
import {DEFAULT_OPTICS_THRESHOLD} from 'src/device_management/constants/opticsThreshold'

const columns = () => opticsDeviceColumns(false, DEFAULT_OPTICS_THRESHOLD)

const widthOf = (key: string): string | undefined => {
  const column = columns().find(c => c.key === key)
  return column?.options?.thead?.style?.width as string | undefined
}

describe('device_management/constants/opticsColumns', () => {
  // optics.scss lays the device table out fixed, so a text column without a
  // width would be sized by the browser and long device names would collide
  // with the next column.
  it('gives every text column an explicit width', () => {
    expect(widthOf('sysName')).toBe('200px')
    expect(widthOf('model')).toBe('130px')
    expect(widthOf('ip')).toBe('110px')
    expect(widthOf('location')).toBe('110px')
    expect(widthOf('status')).toBe('70px')
    expect(widthOf('checkedAt')).toBe('150px')
  })

  // The three gauges share whatever the fixed columns leave.
  it('leaves the metric columns unsized', () => {
    expect(widthOf('tx')).toBeUndefined()
    expect(widthOf('rx')).toBeUndefined()
    expect(widthOf('temp')).toBeUndefined()
  })
})
