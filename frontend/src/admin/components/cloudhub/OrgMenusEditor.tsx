import React from 'react'
import {useTranslation} from 'react-i18next'

import MenuItemRow from 'src/admin/components/cloudhub/MenuItemRow'
import {SidebarMenuItem} from 'src/admin/constants/sidebarMenuItems'
import {
  Dropdown,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
} from 'src/reusable_ui'
import PageSpinner from 'src/shared/components/PageSpinner'
import LoadingDots from 'src/shared/components/LoadingDots'
import {Organization} from 'src/types'

const DropdownItem = Dropdown.Item

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
  const {t} = useTranslation()

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
        <div className="org-menus-editor--heading-left">
          <h2 className="panel-title org-menus-editor--title">
            {t('org_menus.title', 'Organization')}
          </h2>
          {selectedOrgId ? (
            <Dropdown
              selectedID={selectedOrgId}
              onChange={onSelectOrganization}
              buttonColor={ComponentColor.Default}
              buttonSize={ComponentSize.Small}
              widthPixels={220}
              status={
                isSaving ? ComponentStatus.Disabled : ComponentStatus.Default
              }
              customClass="org-menus-editor--org-dropdown"
            >
              {organizations.map(org => (
                <DropdownItem id={org.id} key={org.id} value={org.id}>
                  {org.name}
                </DropdownItem>
              ))}
            </Dropdown>
          ) : null}
        </div>
        {selectedOrg && isSaving ? (
          <div className="org-menus-editor--heading-meta">
            <LoadingDots className="org-menus-editor--saving-dots" />
          </div>
        ) : null}
      </div>

      <div className="panel-body org-menus-editor">
        <div className="org-menus-editor--table-head">
          <div className="org-menus-editor--col-enabled">
            {t('org_menus.col_enabled', 'Enabled')}
          </div>
          <div>{t('org_menus.col_sidebar_menus', 'Sidebar Menus')}</div>
        </div>

        {menuLoadError ? (
          <p className="org-menus-editor--empty">{menuLoadError}</p>
        ) : selectedOrg ? (
          menuItems.length ? (
            <div className="org-menus-editor--table-body">
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
              {t(
                'org_menus.empty_no_menus',
                'No navigation menus found. Check nav_menu_items migration.'
              )}
            </p>
          )
        ) : (
          <p className="org-menus-editor--empty">
            {t(
              'org_menus.empty_choose_org',
              'Choose an organization to configure its sidebar menus.'
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export default OrgMenusEditor
