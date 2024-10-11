import {DateTime} from 'luxon'
import cronParser from 'cron-parser'

export const convertCronExpression = (
  cronExpression: string,
  originalTimeZone: string,
  targetTimeZone: string
): string => {
  const interval = cronParser.parseExpression(cronExpression)
  const cronExpressionFields = getFieldsCron(cronExpression)

  if (
    cronExpressionFields.hour.length === 24 &&
    cronExpressionFields.minute.length === 60
  ) {
    return cronExpression
  }

  const isSpecialTimeFormat = (hourField: string, minuteField: string) => {
    const timePattern = /(\d+-\d+\/\d+)|(\d+(,\d+)+)|(\d+-\d+,\d+(-\d+)*)/
    return timePattern.test(hourField) || timePattern.test(minuteField)
  }

  const nowInOriginalTimeZone = DateTime.now().setZone(originalTimeZone)
  const nowInTargetTimeZone = nowInOriginalTimeZone.setZone(targetTimeZone)
  const timeZoneOffset =
    nowInTargetTimeZone.offset - nowInOriginalTimeZone.offset

  if (
    !isSpecialTimeFormat(
      cronExpressionFields.hour.toString(),
      cronExpressionFields.minute.toString()
    )
  ) {
    const c = getDaysHoursMinutes(
      interval.fields.hour[0],
      interval.fields.minute[0],
      timeZoneOffset
    )

    cronExpressionFields.minute = addMinutes(
      cronExpressionFields.minute,
      c.minutes
    )
    cronExpressionFields.hour = addHours(cronExpressionFields.hour, c.hours)

    if (
      (cronExpressionFields.dayOfMonth.indexOf(1) >= 0 && c.days === -1) ||
      (cronExpressionFields.dayOfMonth.indexOf(31) >= 0 && c.days === 1)
    ) {
      cronExpressionFields.month = addMonth(cronExpressionFields.month, c.days)
    }
    cronExpressionFields.dayOfMonth = addDayOfMonth(
      cronExpressionFields.dayOfMonth,
      c.days,
      targetTimeZone,
      cronExpressionFields.month
    )

    cronExpressionFields.dayOfWeek = addDayOfWeek(
      cronExpressionFields.dayOfWeek,
      c.days
    )

    if (cronExpressionFields.dayOfMonth.includes('L')) {
      const lastDayOfMonthInTargetTZ = DateTime.now()
        .setZone(targetTimeZone)
        .endOf('month').day
      cronExpressionFields.dayOfMonth = [lastDayOfMonthInTargetTZ]
    }
  } else {
    const c = getDaysHoursMinutes(
      interval.fields.hour[0],
      interval.fields.minute[0],
      timeZoneOffset
    )

    cronExpressionFields.minute = addMinutes(
      cronExpressionFields.minute,
      c.minutes
    )
    cronExpressionFields.hour = addHours(cronExpressionFields.hour, c.hours)
  }

  try {
    return setFieldsCron(cronExpressionFields)
  } catch (err: any) {
    if (err.message.includes('Invalid explicit day of month definition')) {
      cronExpressionFields.dayOfMonth = [1]
      cronExpressionFields.month = addMonth(cronExpressionFields.month, 1)
      return setFieldsCron(cronExpressionFields)
    }
    return cronExpression
  }
}

const getDaysHoursMinutes = (hour, minute, timeZoneOffset) => {
  const minutes = hour * 60 + minute
  const newMinutes = minutes + timeZoneOffset
  const diffHour = (Math.floor(newMinutes / 60) % 24) - hour
  const diffMinutes = (newMinutes % 60) - minute
  const diffDays = Math.floor(newMinutes / (60 * 24))

  return {hours: diffHour, minutes: diffMinutes, days: diffDays}
}

const getFieldsCron = (expression: string): any => {
  const interval = cronParser.parseExpression(expression)
  return JSON.parse(JSON.stringify(interval.fields))
}

const setFieldsCron = (fields: any): string => {
  return cronParser.fieldsToExpression(fields).stringify()
}

const addHours = (hours: number[], hour: number) =>
  hours.map(n => {
    const h = n + hour
    if (h > 23) return h - 24
    if (h < 0) return h + 24
    return h
  })

const addMinutes = (minutes: number[], minute: number) =>
  minutes.map(n => {
    const m = n + minute
    if (m > 59) return m - 60
    if (m < 0) return m + 60
    return m
  })

const getLastDayOfMonth = (month: number): number => {
  const currentYear = DateTime.now().year

  const isLeapYear =
    (currentYear % 4 === 0 && currentYear % 100 !== 0) ||
    currentYear % 400 === 0

  const daysInMonth = {
    1: 31,
    2: isLeapYear ? 29 : 28,
    3: 31,
    4: 30,
    5: 31,
    6: 30,
    7: 31,
    8: 31,
    9: 30,
    10: 31,
    11: 30,
    12: 31,
  }

  return daysInMonth[month]
}

const addDayOfMonth = (
  dayOfMonth: any[],
  day: number,
  targetTimeZone: string,
  month: number[]
) => {
  const now = DateTime.now().setZone(targetTimeZone)
  const lastDayOfMonth = now.endOf('month').day

  if (dayOfMonth.length > lastDayOfMonth - 1) return dayOfMonth

  return dayOfMonth.map((n, index) => {
    const d = n + day

    if (d > lastDayOfMonth || n === 'L') return 1
    if (d < 1) {
      return getLastDayOfMonth(month[index])
    }
    return d
  })
}
const addDayOfWeek = (dayOfWeek: any[], day: number) => {
  if (dayOfWeek.length > 6) return dayOfWeek
  return dayOfWeek.map(n => {
    const d = n + day
    if (d > 6) return 0
    if (d < 0) return 6
    return d
  })
}

const addMonth = (month: any[], mon: number) => {
  if (month.length > 11) return month
  return month.map(n => {
    const m = n + mon
    if (m > 12) return 1
    if (m < 1) return 12
    return m
  })
}
