import React from 'react'

import MenuItemRow from 'src/admin/components/cloudhub/MenuItemRow'
import {SidebarMenuItem} from 'src/admin/constants/sidebarMenuItems'
import PageSpinner from 'src/shared/components/PageSpinner'
import {Organization} from 'src/types'

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
          <div className="org-menus-editor--section-title">
            {selectedOrg
              ? `Sidebar Menus — ${selectedOrg.name}`
              : 'Select an organization'}
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
