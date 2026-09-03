import React, {useEffect, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

import * as adminCloudHubActionCreators from 'src/admin/actions/cloudhub'
import {
  getMasterNavMenu,
  getOrgNavMenu,
  updateOrgNavMenu,
} from 'src/admin/apis/orgNavMenu'
import OrgMenusEditor from 'src/admin/components/cloudhub/OrgMenusEditor'
import {
  buildOrgNavMenuUpsertPayload,
  createDefaultMenuSelection,
  collectAncestorMenuIds,
  collectDescendantMenuIds,
  findSidebarMenuItem,
  isOrgMenuLocked,
  mapMasterNavItemsToSidebarMenuItems,
  mapOrgNavItemsToSelection,
  mapOrgNavItemsToSidebarMenuItems,
  SidebarMenuItem,
} from 'src/admin/constants/sidebarMenuItems'
import {SUPERADMIN_ROLE} from 'src/auth/Authorized'
import {ForceSessionAbortInputRole as ForceSessionAbortInputRoleAsync} from 'src/shared/actions/session'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {setOrgNavMenu} from 'src/shared/actions/orgNavMenu'
import {notifyError} from 'src/shared/copy/notifications'
import {DEFAULT_NAV_CHILD} from 'src/side_nav/utils/orgNavMenuVisibility'
import {Links, Notification, NotificationFunc, Organization} from 'src/types'

interface Props {
  links: Links
  organizations: Organization[]
  meCurrentOrganization: Organization | null
  actionsAdmin: {
    loadOrganizationsAsync: (link: string) => void
  }
  ForceSessionAbortInputRole: (role: string) => void
  notify: (message: Notification | NotificationFunc) => void
  setOrgNavMenuSelection: (payload: {
    orgId: string
    selection: Record<string, boolean>
  }) => void
}

const resolvePreferredOrgId = (
  organizations: Organization[],
  meCurrentOrganization: Organization | null
): string | null => {
  if (!organizations.length) {
    return null
  }

  const currentOrgId = meCurrentOrganization?.id
  if (currentOrgId) {
    const matched = organizations.find(org => org.id === currentOrgId)
    if (matched) {
      return matched.id
    }
  }

  return organizations[0].id
}

interface SaveSnapshot {
  selectedOrgId: string | null
  menuItems: SidebarMenuItem[]
  menuSelectionsByOrg: Record<string, Record<string, boolean>>
  isSaving: boolean
}

const OrgMenusPage = ({
  links,
  organizations,
  meCurrentOrganization,
  actionsAdmin: {loadOrganizationsAsync},
  ForceSessionAbortInputRole,
  notify,
  setOrgNavMenuSelection,
}: Props) => {
  const {t} = useTranslation()
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<SidebarMenuItem[]>([])
  const [isMenuItemsLoading, setIsMenuItemsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [menuLoadError, setMenuLoadError] = useState<string | null>(null)
  const [menuSelectionsByOrg, setMenuSelectionsByOrg] = useState<
    Record<string, Record<string, boolean>>
  >({})

  const isMountedRef = useRef(true)
  const isDirtyRef = useRef(false)
  const didAutoSelectOrgRef = useRef(false)
  const prevOrganizationsRef = useRef(organizations)
  const meCurrentOrgIdRef = useRef(meCurrentOrganization?.id || null)
  const setOrgNavMenuSelectionRef = useRef(setOrgNavMenuSelection)
  const saveSnapshotRef = useRef<SaveSnapshot>({
    selectedOrgId: null,
    menuItems: [],
    menuSelectionsByOrg: {},
    isSaving: false,
  })
  const notifyRef = useRef(notify)

  saveSnapshotRef.current = {
    selectedOrgId,
    menuItems,
    menuSelectionsByOrg,
    isSaving,
  }
  notifyRef.current = notify
  meCurrentOrgIdRef.current = meCurrentOrganization?.id || null
  setOrgNavMenuSelectionRef.current = setOrgNavMenuSelection

  const syncSideNavIfCurrentOrg = (
    orgId: string,
    selection: Record<string, boolean>
  ) => {
    if (orgId && orgId === meCurrentOrgIdRef.current) {
      setOrgNavMenuSelectionRef.current({orgId, selection})
    }
  }

  const flushPendingSave = async (): Promise<boolean> => {
    const {
      selectedOrgId: currentOrgId,
      menuItems: currentMenuItems,
      menuSelectionsByOrg: currentSelections,
      isSaving: currentlySaving,
    } = saveSnapshotRef.current

    if (
      !isDirtyRef.current ||
      !currentOrgId ||
      !currentMenuItems.length ||
      currentlySaving
    ) {
      return true
    }

    const selection =
      currentSelections[currentOrgId] ||
      createDefaultMenuSelection(currentMenuItems)
    const navItems = buildOrgNavMenuUpsertPayload(currentMenuItems, selection)

    isDirtyRef.current = false
    if (isMountedRef.current) {
      setIsSaving(true)
    }

    try {
      const {data} = await updateOrgNavMenu(currentOrgId, {navItems})
      if (!isMountedRef.current) {
        return true
      }

      const savedNavItems = data && data.navItems ? data.navItems : navItems
      const savedSelection = mapOrgNavItemsToSelection(savedNavItems)

      setIsSaving(false)
      setMenuSelectionsByOrg(prev => ({
        ...prev,
        [currentOrgId]: savedSelection,
      }))
      syncSideNavIfCurrentOrg(currentOrgId, savedSelection)
      return true
    } catch (error) {
      console.error(error)
      isDirtyRef.current = true
      if (isMountedRef.current) {
        setIsSaving(false)
      }
      notifyRef.current(
        notifyError(
          t(
            'org_menus.save_failed',
            'Failed to save organization menu settings.'
          )
        )
      )
      return false
    }
  }

  const handleSelectOrganization = async (orgId: string) => {
    if (orgId === saveSnapshotRef.current.selectedOrgId) {
      return
    }

    if (isDirtyRef.current) {
      const saved = await flushPendingSave()
      if (!saved) {
        return
      }
    }

    setSelectedOrgId(orgId)
    setIsMenuItemsLoading(true)
    isDirtyRef.current = false

    try {
      const {data} = await getOrgNavMenu(orgId)
      if (!isMountedRef.current) {
        return
      }
      const navItems = data && data.navItems ? data.navItems : []
      const nextMenuItems = mapOrgNavItemsToSidebarMenuItems(navItems)
      const selection = mapOrgNavItemsToSelection(navItems)

      setMenuItems(prev => (nextMenuItems.length ? nextMenuItems : prev))
      setIsMenuItemsLoading(false)
      setMenuLoadError(null)
      setMenuSelectionsByOrg(prev => ({
        ...prev,
        [orgId]: selection,
      }))
      syncSideNavIfCurrentOrg(orgId, selection)
    } catch (error) {
      console.error(error)
      if (!isMountedRef.current) {
        return
      }
      setIsMenuItemsLoading(false)
      setMenuLoadError(null)
      setMenuSelectionsByOrg(prev => {
        if (prev[orgId]) {
          return prev
        }
        return {
          ...prev,
          [orgId]: createDefaultMenuSelection(
            saveSnapshotRef.current.menuItems
          ),
        }
      })
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    ForceSessionAbortInputRole(SUPERADMIN_ROLE)
    loadOrganizationsAsync(links.organizations)

    const loadMasterNavMenu = async () => {
      try {
        const {data} = await getMasterNavMenu()
        const navItems = data && data.navItems ? data.navItems : []
        const nextMenuItems = mapMasterNavItemsToSidebarMenuItems(navItems)
        if (!isMountedRef.current) {
          return
        }
        setMenuItems(nextMenuItems)
        setIsMenuItemsLoading(false)
        setMenuLoadError(null)
      } catch (error) {
        console.error(error)
        if (!isMountedRef.current) {
          return
        }
        setMenuItems([])
        setIsMenuItemsLoading(false)
        setMenuLoadError(
          t(
            'org_menus.load_failed',
            'Failed to load master navigation menus.'
          )
        )
      }
    }

    void loadMasterNavMenu()

    return () => {
      isMountedRef.current = false
      void flushPendingSave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (prevOrganizationsRef.current !== organizations && !selectedOrgId) {
      didAutoSelectOrgRef.current = false
    }
    prevOrganizationsRef.current = organizations

    if (
      !didAutoSelectOrgRef.current &&
      !selectedOrgId &&
      organizations.length &&
      !isMenuItemsLoading
    ) {
      const preferredOrgId = resolvePreferredOrgId(
        organizations,
        meCurrentOrganization
      )
      if (!preferredOrgId) {
        return
      }
      didAutoSelectOrgRef.current = true
      void handleSelectOrganization(preferredOrgId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations, meCurrentOrganization, selectedOrgId, isMenuItemsLoading])

  const handleToggleMenu = (menuId: string) => {
    if (!selectedOrgId || isSaving || isOrgMenuLocked(menuId)) {
      return
    }

    const current =
      menuSelectionsByOrg[selectedOrgId] ||
      createDefaultMenuSelection(menuItems)
    const nextEnabled = !current[menuId]
    const nextSelection = {
      ...current,
      [menuId]: nextEnabled,
    }
    const menuItem = findSidebarMenuItem(menuId, menuItems)

    if (nextEnabled) {
      const ancestors = collectAncestorMenuIds(menuId, menuItems) || []
      ancestors.forEach(ancestorId => {
        nextSelection[ancestorId] = true
      })
      const defaultChild =
        menuItem?.children?.find(
          child => child.id === DEFAULT_NAV_CHILD[menuId]
        ) || menuItem?.children?.[0]
      if (defaultChild) {
        nextSelection[defaultChild.id] = true
      }
    } else {
      if (menuItem) {
        collectDescendantMenuIds(menuItem).forEach(childId => {
          if (!isOrgMenuLocked(childId)) {
            nextSelection[childId] = false
          }
        })
      }
      const parentId = (collectAncestorMenuIds(menuId, menuItems) || []).pop()
      const parent = parentId ? findSidebarMenuItem(parentId, menuItems) : undefined
      const anyChildOn = (parent?.children || []).some(
        child => isOrgMenuLocked(child.id) || nextSelection[child.id] !== false
      )
      if (parentId && parent && !isOrgMenuLocked(parentId) && !anyChildOn) {
        nextSelection[parentId] = false
      }
    }

    isDirtyRef.current = true
    const nextSelectionsByOrg = {
      ...menuSelectionsByOrg,
      [selectedOrgId]: nextSelection,
    }
    setMenuSelectionsByOrg(nextSelectionsByOrg)
    // Keep snapshot in sync so flush reads the latest toggle immediately.
    saveSnapshotRef.current = {
      ...saveSnapshotRef.current,
      menuSelectionsByOrg: nextSelectionsByOrg,
    }
    // Immediately reflect on the live SideNav when editing the active org.
    syncSideNavIfCurrentOrg(selectedOrgId, nextSelection)
    void flushPendingSave()
  }

  ForceSessionAbortInputRole(SUPERADMIN_ROLE)

  const menuSelection =
    (selectedOrgId && menuSelectionsByOrg[selectedOrgId]) ||
    createDefaultMenuSelection(menuItems)

  return (
    <OrgMenusEditor
      organizations={organizations}
      selectedOrgId={selectedOrgId}
      menuItems={menuItems}
      isMenuItemsLoading={isMenuItemsLoading}
      isSaving={isSaving}
      menuLoadError={menuLoadError}
      menuSelection={menuSelection}
      onSelectOrganization={handleSelectOrganization}
      onToggleMenu={handleToggleMenu}
    />
  )
}

const mapStateToProps = ({
  links,
  adminCloudHub: {organizations},
  auth: {me},
}: {
  links: Links
  adminCloudHub: {organizations: Organization[]}
  auth: {me?: {currentOrganization?: Organization}}
}) => ({
  links,
  organizations,
  meCurrentOrganization: me?.currentOrganization || null,
})

const mapDispatchToProps = (dispatch: any) => ({
  actionsAdmin: bindActionCreators(adminCloudHubActionCreators, dispatch),
  ForceSessionAbortInputRole: bindActionCreators(
    ForceSessionAbortInputRoleAsync,
    dispatch
  ),
  notify: bindActionCreators(notifyAction, dispatch),
  setOrgNavMenuSelection: bindActionCreators(setOrgNavMenu, dispatch),
})

export default connect(mapStateToProps, mapDispatchToProps)(OrgMenusPage)
