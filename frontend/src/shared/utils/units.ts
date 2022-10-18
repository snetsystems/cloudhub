const formatBytes = (
  value: number,
  divisor: number,
  decimals: number,
  [currentLabel, ...otherLabels]: string[]
): string => {
  if (value < divisor) {
    return `${value.toFixed(decimals)} ${currentLabel}`
  }
  return formatBytes(value / divisor, divisor, decimals, otherLabels)
}

export const transFormatBytes = (
  bytes: number,
  decimals: number = 0,
  isBinary: boolean = true
) => {
  if (bytes === undefined || bytes === null) return
  // Temporary defense code. To be deleted
  // start
  if (typeof bytes === 'string') {
    return bytes
  }
  // end

  const unit = isBinary ? 1024 : 1000
  const yota = isBinary ? Math.pow(2, 80) : Math.pow(1000, 8)

  if (bytes >= yota) {
    return `${(bytes / yota).toFixed(decimals)} ${unit ? 'YiB' : 'YB'}`
  }
  const format = isBinary
    ? ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB']
    : ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB']

  return formatBytes(bytes, unit, decimals, format)
}

const formatFrequency = (
  value: number,
  decimals: number,
  [currentLabel, ...otherLabels]: string[]
): string => {
  if (value < 1000) {
    return `${value.toFixed(decimals)} ${currentLabel}`
  }
  return formatFrequency(value / 1000, decimals, otherLabels)
}

export const transFormatFrequency = (
  hertz: number,
  decimals: number = 0
): string => {
  // Temporary defense code. To be deleted
  // start
  if (typeof hertz === 'string') {
    return hertz
  }
  // end

  const yota = Math.pow(10, 24)
  if (hertz >= yota) {
    return `${(hertz / yota).toFixed(decimals)} YHz`
  }
  const format = ['Hz', 'kHz', 'MHz', 'GHz', 'THz', 'PHz', 'EHz', 'ZHz']

  return formatFrequency(hertz, decimals, format)
}

export const transBytes = (
  fileSize: number,
  fractionDigits?: number
): string | number => {
  let str: string | number = ''

  if (fileSize >= 1024 * 1024 * 1024 * 1024) {
    fileSize = fileSize / (1024 * 1024 * 1024 * 1024)
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' TB'
  } else if (fileSize >= 1024 * 1024 * 1024) {
    fileSize = fileSize / (1024 * 1024 * 1024)
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' GB'
  } else if (fileSize >= 1024 * 1024) {
    fileSize = fileSize / (1024 * 1024)
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' MB'
  } else if (fileSize >= 1024) {
    fileSize = fileSize / 1024
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' KB'
  } else {
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' Byte'
  }
  return str
}

export const transBps = (
  fileSize: number,
  fractionDigits?: number
): string | number => {
  let str: string | number = ''

  if (fileSize === null || fileSize === undefined) return str

  if (fileSize >= 1024 * 1024 * 1024 * 1024) {
    fileSize = fileSize / (1024 * 1024 * 1024 * 1024)
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' Tbps'
  } else if (fileSize >= 1024 * 1024 * 1024) {
    fileSize = fileSize / (1024 * 1024 * 1024)
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' Gbps'
  } else if (fileSize >= 1024 * 1024) {
    fileSize = fileSize / (1024 * 1024)
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' Mbps'
  } else if (fileSize >= 1024) {
    fileSize = fileSize / 1024
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' Kbps'
  } else {
    const transformed: string | number =
      fractionDigits === undefined ? fileSize : fileSize.toFixed(fractionDigits)
    str = transformed + ' bps'
  }
  return str
}

export const calculateDataStorage = (
  fileSize: number,
  dataUnit?: string,
  fractionDigits: number = 2
) => {
  const bytesFileSize = convertFileSizeToBytes(fileSize, dataUnit)
  return transBytes(bytesFileSize, fractionDigits)
}
export const convertFileSizeToBytes = (
  fileSize: number,
  dataUnit: string = 'Byte'
): number => {
  const upperCaseDataUnit = dataUnit.toUpperCase()
  if (upperCaseDataUnit === 'TB') {
    fileSize = fileSize * 1024 * 1024 * 1024 * 1024
  } else if (upperCaseDataUnit === 'GB') {
    fileSize = fileSize * 1024 * 1024 * 1024
  } else if (upperCaseDataUnit === 'MB') {
    fileSize = fileSize * 1024 * 1024
  } else if (upperCaseDataUnit === 'KB') {
    fileSize = fileSize * 1024
  }
  return fileSize
}
