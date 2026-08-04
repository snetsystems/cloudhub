import React from 'react'

import SlideToggle from 'src/reusable_ui/components/slide_toggle/SlideToggle'
import {ComponentColor, ComponentSize} from 'src/reusable_ui/types'
import PageSpinner from 'src/shared/components/PageSpinner'
import {Organization} from 'src/types'
import {SidebarMenuItem} from 'src/admin/constants/sidebarMenuItems'

interface Props {
  organizations: Organization[]
  selectedOrgId: string | null
  menuItems: SidebarMenuItem[]
  isMenuItemsLoading: boolean
  isSaving: boolean
  menuLoadError: string | null
  menuSelection: Record<string, boolean>
  onSelectOrganization: (orgId: string) => void
  onToggleMenu: (menuId: string) => void
  onEnableAllMenus: () => void
  onDisableAllMenus: () => void
  onResetMenus: () => void
}

interface MenuItemRowProps {
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
}: MenuItemRowProps) => {
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
          tooltipText={item.label}
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

const OrgMenusEditor = ({
  organizations,
  selectedOrgId,
  menuItems,
  isMenuItemsLoading,
  isSaving,
  menuLoadError,
  menuSelection,
  onSelectOrganization,
  onToggleMenu,
  onEnableAllMenus,
  onDisableAllMenus,
  onResetMenus,
}: Props) => {
  if (!organizations.length || isMenuItemsLoading) {
    return (
      <div className="panel panel-solid">
        <div className="panel-body">
          <PageSpinner />
        </div>
      </div>
    )
  }

  const selectedOrg = organizations.find(org => org.id === selectedOrgId)
  const canEditMenus = !!(selectedOrg && menuItems.length)

  return (
    <div className="panel panel-solid">
      <div className="panel-heading">
        <h2 className="panel-title">Org Menus</h2>
      </div>
      <div className="panel-body org-menus-editor">
        <div className="org-menus-editor--orgs">
          <div className="org-menus-editor--section-title">Organizations</div>
          <div className="org-menus-editor--org-list">
            {organizations.map(org => (
              <div
                key={org.id}
                className={`org-menus-editor--org-item${
                  org.id === selectedOrgId ? ' active' : ''
                }`}
                onClick={() => onSelectOrganization(org.id)}
              >
                {org.name}
              </div>
            ))}
          </div>
        </div>
        <div className="org-menus-editor--menus">
          <div className="org-menus-editor--menus-header">
            <div className="org-menus-editor--section-title">
              {selectedOrg
                ? `Sidebar Menus — ${selectedOrg.name}`
                : 'Select an organization'}
            </div>
            {canEditMenus ? (
              <div className="org-menus-editor--bulk-actions">
                <button
                  type="button"
                  className="btn btn-xs btn-default"
                  disabled={isSaving}
                  title="Restore to the previous settings of this org menu"
                  onClick={onResetMenus}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-default"
                  disabled={isSaving}
                  onClick={onEnableAllMenus}
                >
                  All On
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-default"
                  disabled={isSaving}
                  onClick={onDisableAllMenus}
                >
                  All Off
                </button>
              </div>
            ) : null}
          </div>
          {menuLoadError ? (
            <p className="org-menus-editor--empty">{menuLoadError}</p>
          ) : selectedOrg ? (
            menuItems.length ? (
              <div className="org-menus-editor--menu-list">
                {menuItems.map(item => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    menuSelection={menuSelection}
                    isSaving={isSaving}
                    onToggleMenu={onToggleMenu}
                  />
                ))}
              </div>
            ) : (
              <p className="org-menus-editor--empty">
                No navigation menus found. Check nav_menu_items migration.
              </p>
            )
          ) : (
            <p className="org-menus-editor--empty">
              Choose an organization to configure its sidebar menus.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default OrgMenusEditor
