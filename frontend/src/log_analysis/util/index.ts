import moment from 'moment'
import {TimeZones} from 'src/types'

export const formattedTime = (
  timestampInput: string | null,
  targetZone: TimeZones
): string => {
  if (!timestampInput) {
    return '–'
  }

  const isMillisString = /^\d+$/.test(timestampInput)
  const timestampMillis = isMillisString ? Number(timestampInput) : undefined

  const utcMoment =
    timestampMillis !== undefined
      ? moment.utc(timestampMillis)
      : moment.utc(timestampInput)

  if (targetZone === TimeZones.UTC) {
    return utcMoment.format('YYYY-MM-DD HH:mm:ss')
  }

  return utcMoment.local().format('YYYY-MM-DD HH:mm:ss')
}
