/** The collector writes "unknown" when the device reports no description. */
export const readAlias = (value: string | undefined): string =>
  !value || value === 'unknown' ? '' : value

/**
 * The key the optics rows and the interface rows are joined on.
 *
 * IOS-XE names one port two ways: the sensor rows carry the long form
 * ("GigabitEthernet1/1/1") and the interface rows the abbreviation
 * ("Gi1/1/1"), so joining on the literal name loses the alias and the link
 * state for every Catalyst port. NX-OS uses one form on both sides, which is
 * why this went unnoticed.
 *
 * Two letters is what Cisco's own abbreviations come down to, and it is enough
 * to keep the types apart: Gi/Fa/Fo, Te/Tw, Hu, Et, Po, Vl. The numbering is
 * kept verbatim, so ports of the same type never collide.
 */
export const canonicalIfName = (name: string): string => {
  const parts = /^([A-Za-z-]+)(.*)$/.exec(name.trim())
  return parts
    ? parts[1].slice(0, 2).toLowerCase() + parts[2]
    : name.trim().toLowerCase()
}

/**
 * Sorts ports the way an operator reads them: Ethernet1/2 before Ethernet1/10,
 * which a plain string compare gets wrong.
 */
export const comparePorts = (
  a: {ifName: string},
  b: {ifName: string}
): number => {
  const segsOf = (s: string) => (s.match(/\d+/g) ?? []).map(Number)
  const [sa, sb] = [segsOf(a.ifName), segsOf(b.ifName)]
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    const diff = (sa[i] ?? -1) - (sb[i] ?? -1)
    if (diff !== 0) {
      return diff
    }
  }
  return a.ifName.localeCompare(b.ifName)
}
