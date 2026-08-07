import React from 'react'

import {SidebarMenuItem} from 'src/admin/constants/sidebarMenuItems'
import SlideToggle from 'src/reusable_ui/components/slide_toggle/SlideToggle'
import {ComponentColor, ComponentSize} from 'src/reusable_ui/types'

interface Props {
  item: SidebarMenuItem
  menuSelection: Record<string, boolean>
  isSaving: boolean
  onToggleMenu: (menuId: string) => void
  /** Top-level items show SideNav icons before the label. */
  depth?: number
}

const MenuItemRow = ({
  item,
  menuSelection,
  isSaving,
  onToggleMenu,
  depth = 0,
}: Props) => {
  const isChecked = menuSelection[item.id] !== false
  const showIcon = depth === 0 && !!item.icon

  return (
    <div className="org-menus-editor--menu-group">
      <div className="org-menus-editor--menu-item">
        <SlideToggle
          color={ComponentColor.Success}
          size={ComponentSize.ExtraSmall}
          active={isChecked}
          disabled={isSaving}
          onChange={() => onToggleMenu(item.id)}
        />
        <span
          className={`org-menus-editor--menu-label${
            isSaving ? ' is-disabled' : ''
          }`}
          onClick={() => {
            if (!isSaving) {
              onToggleMenu(item.id)
            }
          }}
        >
          {showIcon ? (
            <span className={`icon org-menus-editor--menu-icon ${item.icon}`} />
          ) : null}
          {item.label}
        </span>
      </div>
      {item.children?.map(child => (
        <MenuItemRow
          key={child.id}
          item={child}
          menuSelection={menuSelection}
          isSaving={isSaving}
          onToggleMenu={onToggleMenu}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export default MenuItemRow
