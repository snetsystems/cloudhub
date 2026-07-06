export const formatWindowDuration = (
  start?: string,
  end?: string
): string | null => {
  if (!start || !end) return null
  const startTime = Date.parse(start)
  const endTime = Date.parse(end)
  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    endTime <= startTime
  ) {
    return null
  }

  const seconds = Math.round((endTime - startTime) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.round(minutes / 60)}h`
}
