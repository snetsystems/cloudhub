export const transMemoryToBytes = (bytes: string) => {
  if (bytes === undefined || bytes === null) return 0

  let result = 0

  if (typeof bytes === 'string') {
    const unit = bytes.substr(bytes.length - 2, bytes.length)
    const value = bytes.substr(0, bytes.length - 2)

    switch (unit) {
      case 'Ki':
        return (result = parseFloat(value) * 1024)
      case 'Mi':
        return (result = parseFloat(value) * 1024 * 1024)
      case 'Gi':
        return (result = parseFloat(value) * 1024 * 1024 * 1024)
      case 'Ti':
        return (result = parseFloat(value) * 1024 * 1024 * 1024 * 1024)
      case 'Pi':
        return (result = parseFloat(value) * 1024 * 1024 * 1024 * 1024 * 1024)
      case 'KB':
        return (result = parseFloat(value) * 1024)
      case 'MB':
        return (result = parseFloat(value) * 1024 * 1024)
      case 'GB':
        return (result = parseFloat(value) * 1024 * 1024 * 1024)
      case 'TB':
        return (result = parseFloat(value) * 1024 * 1024 * 1024 * 1024)
      case 'PB':
        return (result = parseFloat(value) * 1024 * 1024 * 1024 * 1024 * 1024)
      default:
        return result
    }
  }

  return result
}

export const transToCPUMillCore = (param: string, objKind: string) => {
  if (param === undefined || param === null) return 0

  let result = 0

  if (typeof param === 'string') {
    if (objKind === 'pod') {
      const unit = param.substr(param.length - 1, param.length)

      result =
        unit !== 'm'
          ? parseFloat(param) * 1000
          : parseFloat(param.substr(0, param.length - 2))
    } else if (objKind === 'node') {
      result = parseFloat(param) * 1000
    }
  }

  return result
}
