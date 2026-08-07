/**
 * Whether a sidebar menu id should be shown for the current organization.
 * Missing keys default to visible (fail-open / menus not yet in master).
 */
export const isOrgNavMenuEnabled = (
  selection: Record<string, boolean> | null | undefined,
  menuId: string
): boolean => {
  if (!selection || !(menuId in selection)) {
    return true
  }
  return selection[menuId] !== false
}
