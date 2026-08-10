import React from 'react'
import classnames from 'classnames'

import {
  isOrgMenuLocked,
  SidebarMenuItem,
} from 'src/admin/constants/sidebarMenuItems'
import SlideToggle from 'src/reusable_ui/components/slide_toggle/SlideToggle'
import {ComponentColor, ComponentSize} from 'src/reusable_ui/types'

interface Props {
  item: SidebarMenuItem
  menuSelection: Record<string, boolean>
  isSaving: boolean
  onToggleMenu: (menuId: string) => void
  depth?: number
}

const MenuItemRow = ({
  item,
  menuSelection,
  isSaving,
  onToggleMenu,
  depth = 0,
}: Props) => {
  const isLocked = isOrgMenuLocked(item.id)
  const isChecked = isLocked || menuSelection[item.id] !== false
  const isNested = depth > 0
  const canToggle = !isSaving && !isLocked

  return (
    <div
      className={classnames(
        'org-menus-editor--menu-group',
        !isNested && 'org-menus-editor--menu-group__parent',
        !isNested && !isChecked && 'org-menus-editor--menu-group__off'
      )}
    >
      <div className="org-menus-editor--menu-item">
        <div className="org-menus-editor--menu-toggle">
          <SlideToggle
            color={ComponentColor.Success}
            size={ComponentSize.ExtraSmall}
            active={isChecked}
            disabled={!canToggle}
            onChange={() => onToggleMenu(item.id)}
          />
        </div>
        <div className="org-menus-editor--menu-body">
          <span
            className={classnames(
              'org-menus-editor--menu-label',
              isChecked && 'is-active',
              isSaving && 'is-disabled'
            )}
            onClick={() => {
              if (canToggle) {
                onToggleMenu(item.id)
              }
            }}
          >
            {!isNested && item.icon ? (
              <span
                className={`icon org-menus-editor--menu-icon ${item.icon}`}
                aria-hidden={true}
              />
            ) : null}
            {item.label}
          </span>
        </div>
      </div>

      {!isNested && item.children?.length ? (
        <div className="org-menus-editor--menu-children">
          {item.children.map(child => (
            <MenuItemRow
              key={child.id}
              item={child}
              menuSelection={menuSelection}
              isSaving={isSaving}
              onToggleMenu={onToggleMenu}
              depth={1}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default MenuItemRow
