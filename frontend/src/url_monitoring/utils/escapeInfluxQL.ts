/** Escape a string for single-quoted literals in InfluxQL WHERE clauses. */
export function escapeInfluxQLString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
