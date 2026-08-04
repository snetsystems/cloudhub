import React, {PureComponent} from 'react'
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
  createBulkMenuSelection,
  createDefaultMenuSelection,
  collectAncestorMenuIds,
  collectDescendantMenuIds,
  findSidebarMenuItem,
  mapMasterNavItemsToSidebarMenuItems,
  mapOrgNavItemsToSelection,
  mapOrgNavItemsToSidebarMenuItems,
  SidebarMenuItem,
} from 'src/admin/constants/sidebarMenuItems'
import {SUPERADMIN_ROLE} from 'src/auth/Authorized'
import {ForceSessionAbortInputRole as ForceSessionAbortInputRoleAsync} from 'src/shared/actions/session'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifyError, notifySuccess} from 'src/shared/copy/notifications'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {Links, Notification, NotificationFunc, Organization} from 'src/types'

interface Props {
  links: Links
  organizations: Organization[]
  actionsAdmin: {
    loadOrganizationsAsync: (link: string) => void
  }
  ForceSessionAbortInputRole: (role: string) => void
  notify: (message: Notification | NotificationFunc) => void
}

interface State {
  selectedOrgId: string | null
  menuItems: SidebarMenuItem[]
  isMenuItemsLoading: boolean
  isSaving: boolean
  menuLoadError: string | null
  menuSelectionsByOrg: Record<string, Record<string, boolean>>
  /** Last loaded/saved selection per org — Reset restores from this. */
  baselineSelectionsByOrg: Record<string, Record<string, boolean>>
}

@ErrorHandling
class OrgMenusPage extends PureComponent<Props, State> {
  public state: State = {
    selectedOrgId: null,
    menuItems: [],
    isMenuItemsLoading: true,
    isSaving: false,
    menuLoadError: null,
    menuSelectionsByOrg: {},
    baselineSelectionsByOrg: {},
  }

  private didAutoSelectOrg = false
  private isDirty = false
  private isMountedFlag = true

  public componentWillMount() {
    const {
      links,
      actionsAdmin: {loadOrganizationsAsync},
      ForceSessionAbortInputRole,
    } = this.props

    ForceSessionAbortInputRole(SUPERADMIN_ROLE)
    loadOrganizationsAsync(links.organizations)
    this.loadMasterNavMenu()
  }

  public componentWillUnmount() {
    this.isMountedFlag = false
    void this.flushPendingSave({silent: true})
  }

  public componentDidUpdate(prevProps: Props) {
    const {organizations} = this.props
    if (
      !this.didAutoSelectOrg &&
      !this.state.selectedOrgId &&
      organizations.length &&
      !this.state.isMenuItemsLoading
    ) {
      this.didAutoSelectOrg = true
      this.handleSelectOrganization(organizations[0].id)
    }

    if (prevProps.organizations !== organizations && !this.state.selectedOrgId) {
      this.didAutoSelectOrg = false
    }
  }

  public render() {
    const {organizations, ForceSessionAbortInputRole} = this.props
    const {
      selectedOrgId,
      menuItems,
      isMenuItemsLoading,
      isSaving,
      menuLoadError,
      menuSelectionsByOrg,
    } = this.state

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
        onSelectOrganization={this.handleSelectOrganization}
        onToggleMenu={this.handleToggleMenu}
        onEnableAllMenus={this.handleEnableAllMenus}
        onDisableAllMenus={this.handleDisableAllMenus}
        onResetMenus={this.handleResetMenus}
      />
    )
  }

  private loadMasterNavMenu = async () => {
    try {
      const {data} = await getMasterNavMenu()
      const navItems = data && data.navItems ? data.navItems : []
      const menuItems = mapMasterNavItemsToSidebarMenuItems(navItems)
      if (!this.isMountedFlag) {
        return
      }
      this.setState({
        menuItems,
        isMenuItemsLoading: false,
        menuLoadError: null,
      })
    } catch (error) {
      console.error(error)
      if (!this.isMountedFlag) {
        return
      }
      this.setState({
        menuItems: [],
        isMenuItemsLoading: false,
        menuLoadError: 'Failed to load master navigation menus.',
      })
    }
  }

  private flushPendingSave = async ({
    silent = true,
  }: {silent?: boolean} = {}): Promise<boolean> => {
    const {notify} = this.props
    const {selectedOrgId, menuItems, menuSelectionsByOrg, isSaving} = this.state

    if (!this.isDirty || !selectedOrgId || !menuItems.length || isSaving) {
      return true
    }

    const selection =
      menuSelectionsByOrg[selectedOrgId] ||
      createDefaultMenuSelection(menuItems)
    const navItems = buildOrgNavMenuUpsertPayload(menuItems, selection)

    this.isDirty = false
    if (this.isMountedFlag) {
      this.setState({isSaving: true})
    }

    try {
      const {data} = await updateOrgNavMenu(selectedOrgId, {navItems})
      if (!this.isMountedFlag) {
        return true
      }

      const savedNavItems = data && data.navItems ? data.navItems : navItems
      const savedSelection = mapOrgNavItemsToSelection(savedNavItems)

      this.setState(prevState => ({
        isSaving: false,
        menuSelectionsByOrg: {
          ...prevState.menuSelectionsByOrg,
          [selectedOrgId]: savedSelection,
        },
        baselineSelectionsByOrg: {
          ...prevState.baselineSelectionsByOrg,
          [selectedOrgId]: {...savedSelection},
        },
      }))

      if (!silent) {
        notify(notifySuccess('Organization menu settings saved.'))
      }
      return true
    } catch (error) {
      console.error(error)
      this.isDirty = true
      if (this.isMountedFlag) {
        this.setState({isSaving: false})
      }
      notify(notifyError('Failed to save organization menu settings.'))
      return false
    }
  }

  private handleSelectOrganization = async (orgId: string) => {
    const {selectedOrgId} = this.state
    if (orgId === selectedOrgId) {
      return
    }

    if (this.isDirty) {
      const saved = await this.flushPendingSave({silent: true})
      if (!saved) {
        return
      }
    }

    this.setState({selectedOrgId: orgId, isMenuItemsLoading: true})
    this.isDirty = false

    try {
      const {data} = await getOrgNavMenu(orgId)
      if (!this.isMountedFlag) {
        return
      }
      const navItems = data && data.navItems ? data.navItems : []
      const menuItems = mapOrgNavItemsToSidebarMenuItems(navItems)
      const selection = mapOrgNavItemsToSelection(navItems)

      this.setState(prevState => ({
        menuItems: menuItems.length ? menuItems : prevState.menuItems,
        isMenuItemsLoading: false,
        menuLoadError: null,
        menuSelectionsByOrg: {
          ...prevState.menuSelectionsByOrg,
          [orgId]: selection,
        },
        baselineSelectionsByOrg: {
          ...prevState.baselineSelectionsByOrg,
          [orgId]: {...selection},
        },
      }))
    } catch (error) {
      console.error(error)
      if (!this.isMountedFlag) {
        return
      }
      this.setState(prevState => {
        const menuSelectionsByOrg = {...prevState.menuSelectionsByOrg}
        const baselineSelectionsByOrg = {
          ...prevState.baselineSelectionsByOrg,
        }
        if (!menuSelectionsByOrg[orgId]) {
          const selection = createDefaultMenuSelection(prevState.menuItems)
          menuSelectionsByOrg[orgId] = selection
          baselineSelectionsByOrg[orgId] = {...selection}
        }
        return {
          isMenuItemsLoading: false,
          menuLoadError: null,
          menuSelectionsByOrg,
          baselineSelectionsByOrg,
        }
      })
    }
  }

  private markDirty = () => {
    this.isDirty = true
  }

  private handleToggleMenu = (menuId: string) => {
    const {selectedOrgId, menuSelectionsByOrg, menuItems, isSaving} = this.state
    if (!selectedOrgId || isSaving) {
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

    if (nextEnabled) {
      const ancestors = collectAncestorMenuIds(menuId, menuItems) || []
      ancestors.forEach(ancestorId => {
        nextSelection[ancestorId] = true
      })
    } else {
      const menuItem = findSidebarMenuItem(menuId, menuItems)
      if (menuItem) {
        collectDescendantMenuIds(menuItem).forEach(childId => {
          nextSelection[childId] = false
        })
      }
    }

    this.markDirty()
    this.setState({
      menuSelectionsByOrg: {
        ...menuSelectionsByOrg,
        [selectedOrgId]: nextSelection,
      },
    })
  }

  private handleEnableAllMenus = () => {
    this.applyBulkMenuSelection(true)
  }

  private handleDisableAllMenus = () => {
    this.applyBulkMenuSelection(false)
  }

  private applyBulkMenuSelection = (enabled: boolean) => {
    const {selectedOrgId, menuItems, menuSelectionsByOrg, isSaving} = this.state
    if (!selectedOrgId || !menuItems.length || isSaving) {
      return
    }

    this.markDirty()
    this.setState({
      menuSelectionsByOrg: {
        ...menuSelectionsByOrg,
        [selectedOrgId]: createBulkMenuSelection(menuItems, enabled),
      },
    })
  }

  private handleResetMenus = () => {
    const {selectedOrgId, menuItems, isSaving, baselineSelectionsByOrg} =
      this.state

    if (!selectedOrgId || isSaving) {
      return
    }

    const baseline =
      baselineSelectionsByOrg[selectedOrgId] ||
      createDefaultMenuSelection(menuItems)

    this.isDirty = false
    this.setState(prevState => ({
      menuSelectionsByOrg: {
        ...prevState.menuSelectionsByOrg,
        [selectedOrgId]: {...baseline},
      },
    }))
  }
}

const mapStateToProps = ({
  links,
  adminCloudHub: {organizations},
}: {
  links: Links
  adminCloudHub: {organizations: Organization[]}
}) => ({
  links,
  organizations,
})

const mapDispatchToProps = (dispatch: any) => ({
  actionsAdmin: bindActionCreators(adminCloudHubActionCreators, dispatch),
  ForceSessionAbortInputRole: bindActionCreators(
    ForceSessionAbortInputRoleAsync,
    dispatch
  ),
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mapStateToProps, mapDispatchToProps)(OrgMenusPage)
