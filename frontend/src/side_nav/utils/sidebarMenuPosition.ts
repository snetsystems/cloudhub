import {CSSProperties} from 'react'

export function computeSidebarMenuStyle(
  itemRect: DOMRect,
  menuHeight: number,
  viewportHeight: number = window.innerHeight
): CSSProperties {
  const left = itemRect.right
  const opensUpward =
    menuHeight > 0 && itemRect.top + menuHeight > viewportHeight

  if (opensUpward) {
    return {
      top: 'auto',
      bottom: viewportHeight - itemRect.bottom,
      left,
    }
  }

  return {
    top: itemRect.top,
    left,
  }
}

export function isSidebarMenuOpeningUpward(
  itemRect: DOMRect,
  menuHeight: number,
  viewportHeight: number = window.innerHeight
): boolean {
  return menuHeight > 0 && itemRect.top + menuHeight > viewportHeight
}
