/** Series of the index-th query in an executeQueries response. */
export const seriesOf = (res: any, index: number): any[] =>
  res?.[index]?.value?.results?.[0]?.series ?? []

/** A column value as a number; null for the gaps InfluxDB leaves. */
export const num = (v: any): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v)

export const toISO = (ms: number | null): string =>
  ms ? new Date(ms).toISOString() : ''
