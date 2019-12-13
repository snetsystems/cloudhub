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
