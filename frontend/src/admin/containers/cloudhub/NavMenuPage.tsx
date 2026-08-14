import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {connect} from 'react-redux'
import {useTranslation} from 'react-i18next'
import {
  Button,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  IconFont,
} from 'src/reusable_ui'
import NavMenuEditor from 'src/admin/components/cloudhub/NavMenuEditor'
import {
  deleteMasterNavMenuItem,
  getMasterNavMenu,
  updateMasterNavMenu,
} from 'src/admin/apis/orgNavMenu'
import PageSpinner from 'src/shared/components/PageSpinner'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {notifySuccess, notifyError} from 'src/shared/copy/notifications'
import {
  MasterNavMenuItem,
  MasterNavMenuResponse,
  MasterNavMenuUpsertItem,
  MasterNavMenuUpsertRequest,
  NotificationAction,
} from 'src/types'

export interface NavMenuItem {
  id: string
  parentId: string | null
  label: string
  /** Preset icomoon class name. */
  icon: string | null
  sortOrder: number
  locked: boolean
  deleted: boolean
  children: NavMenuItem[]
}

/** Sibling-only DnD payload (parentId null = top-level). */
export interface NavMenuDragPayload {
  id: string
  parentId: string | null
}

export type NavMenuIconOption = {id: string; label: string}

/** Items that cannot be renamed, reordered, hidden, or deleted (incl. descendants). */
const LOCKED_NAV_MENU_IDS = new Set([
  'admin',
  'admin-cloudhub',
  'admin-influxdb',
  'configuration',
  'configuration-sources',
  'configuration-agent',
  'user',
])

const NAV_MENU_ICON_OPTIONS: NavMenuIconOption[] = [
  {id: 'graphline-2', label: 'graphline-2'},
  {id: 'dash-j', label: 'dash-j'},
  {id: 'network', label: 'network'},
  {id: 'server2', label: 'server2'},
  {id: 'sphere', label: 'sphere'},
  {id: 'disks', label: 'disks'},
  {id: 'tachometer', label: 'tachometer'},
  {id: 'kubernetes', label: 'kubernetes'},
  {id: 'openstack', label: 'openstack'},
  {id: 'vmware', label: 'vmware'},
  {id: 'document', label: 'document'},
  {id: 'bell', label: 'bell'},
  {id: 'crown-outline', label: 'crown-outline'},
  {id: 'wrench', label: 'wrench'},
  {id: 'user', label: 'user'},
  {id: 'cube', label: 'cube'},
  {id: 'bash', label: 'bash'},
  {id: 'pulse-c', label: 'pulse-c'},
  {id: 'eye', label: 'eye'},
  {id: 'cog-outline', label: 'cog-outline'},
  {id: 'ai-icon', label: 'ai-icon'},
  {id: 'chat', label: 'chat'},
]

interface Props {
  notify: NotificationAction
}

/** AJAX throws response object { status, data: { message } } */
const getRequestErrorMessage = (error: any, fallback: string): string =>
  error?.data?.message || error?.message || fallback

const mapMasterNavItemsToNavMenuItems = (
  navItems: MasterNavMenuItem[] | undefined | null
): NavMenuItem[] => {
  if (!navItems || !navItems.length) {
    return []
  }

  return navItems.map(item => {
    const locked = LOCKED_NAV_MENU_IDS.has(item.id)

    return {
      id: item.id,
      parentId: null,
      label: item.label || item.id,
      icon: item.icon || null,
      sortOrder: Number(item.sortOrder) || 0,
      locked,
      deleted: Boolean(item.deleteYN),
      children: (item.children || []).map(child => ({
        id: child.id,
        parentId: item.id,
        label: child.label || child.id,
        icon: null,
        sortOrder: Number(child.sortOrder) || 0,
        locked: locked || LOCKED_NAV_MENU_IDS.has(child.id),
        deleted: Boolean(child.deleteYN),
        children: [],
      })),
    }
  })
}

const sortOrderField = (
  sortOrder: number | undefined
): {sortOrder?: number} => {
  if (sortOrder == null || sortOrder === 0) {
    return {}
  }
  return {sortOrder}
}

const toMasterNavUpsertItem = (item: NavMenuItem): MasterNavMenuUpsertItem => {
  const children = (item.children || []).map(child => ({
    id: child.id,
    label: child.label,
    ...sortOrderField(child.sortOrder),
  }))

  return {
    id: item.id,
    label: item.label,
    ...(item.icon ? {icon: item.icon} : {}),
    ...sortOrderField(item.sortOrder),
    ...(children.length ? {children} : {}),
  }
}

const mapNavMenuItemsToMasterUpsert = (
  items: NavMenuItem[]
): MasterNavMenuUpsertRequest => {
  const navItems: MasterNavMenuUpsertItem[] = items
    .filter(item => !item.deleted)
    .map(item => {
      const children = (item.children || [])
        .filter(child => !child.deleted)
        .map(child => ({
          id: child.id,
          label: child.label,
          ...sortOrderField(child.sortOrder),
        }))

      return {
        id: item.id,
        label: item.label,
        ...(item.icon ? {icon: item.icon} : {}),
        ...sortOrderField(item.sortOrder),
        ...(children.length ? {children} : {}),
      }
    })

  return {navItems}
}

const mapNavMenuItemsToMasterRestore = (
  items: NavMenuItem[],
  restoreId: string
): MasterNavMenuUpsertRequest => {
  for (const node of items) {
    if (node.id === restoreId) {
      return {navItems: [toMasterNavUpsertItem({...node, deleted: false})]}
    }
    for (const child of node.children || []) {
      if (child.id === restoreId) {
        return {
          navItems: [
            {
              id: node.id,
              label: node.label,
              ...(node.icon ? {icon: node.icon} : {}),
              ...sortOrderField(node.sortOrder),
              children: [
                {
                  id: child.id,
                  label: child.label,
                  ...sortOrderField(child.sortOrder),
                },
              ],
            },
          ],
        }
      }
    }
  }
  return {navItems: []}
}

/** Soft-delete / restore one node. Soft-delete cascades to descendants. */
const setNavMenuItemDeleted = (
  nodes: NavMenuItem[],
  id: string,
  deleted: boolean
): NavMenuItem[] =>
  nodes.map(node => {
    if (node.id === id) {
      if (deleted) {
        const cascade = (n: NavMenuItem): NavMenuItem => ({
          ...n,
          deleted: true,
          children: n.children.map(cascade),
        })
        return cascade(node)
      }
      return {
        ...node,
        deleted: false,
        children:
          node.parentId === null
            ? node.children.map(c => ({...c, deleted: false}))
            : node.children,
      }
    }
    if (!node.children.length) {
      return node
    }
    return {
      ...node,
      children: setNavMenuItemDeleted(node.children, id, deleted),
    }
  })

const NavMenuPage = ({notify}: Props) => {
  const {t} = useTranslation()
  const [items, setItems] = useState<NavMenuItem[]>([])
  const [baseline, setBaseline] = useState<NavMenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const {data} = await getMasterNavMenu()
      const response = (data || {navItems: []}) as MasterNavMenuResponse
      const next = mapMasterNavItemsToNavMenuItems(response.navItems)
      setItems(next)
      setBaseline(structuredClone(next))
    } catch (e) {
      console.error(e)
      setItems([])
      setBaseline([])
      notify(
        notifyError(
          getRequestErrorMessage(
            e,
            t('nav_menu.load_failed', 'Failed to load master nav menu.')
          )
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [notify, t])

  useEffect(() => {
    load()
  }, [load])

  const isDirty = useMemo(
    () => JSON.stringify(items) !== JSON.stringify(baseline),
    [items, baseline]
  )

  const commitTree = useCallback((next: NavMenuItem[]) => {
    setItems(next)
    setBaseline(structuredClone(next))
  }, [])

  const handleSaveLayout = async () => {
    setIsSaving(true)
    try {
      await updateMasterNavMenu(mapNavMenuItemsToMasterUpsert(items))
      setBaseline(structuredClone(items))
      notify(
        notifySuccess(
          t('nav_menu.save_success', 'Menu layout saved successfully.')
        )
      )
    } catch (e) {
      console.error(e)
      notify(
        notifyError(
          getRequestErrorMessage(
            e,
            t('nav_menu.save_failed', 'Failed to save menu layout.')
          )
        )
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteApi = async (id: string) => {
    if (togglingId) {
      return
    }
    setTogglingId(id)
    const prevItems = items
    const prevBaseline = baseline
    commitTree(setNavMenuItemDeleted(items, id, true))
    try {
      await deleteMasterNavMenuItem(id)
      notify(
        notifySuccess(t('nav_menu.delete_success', 'Menu item deactivated.'))
      )
    } catch (e) {
      console.error(e)
      setItems(prevItems)
      setBaseline(prevBaseline)
      notify(
        notifyError(
          getRequestErrorMessage(
            e,
            t('nav_menu.delete_failed', 'Failed to delete menu item.')
          )
        )
      )
    } finally {
      setTogglingId(null)
    }
  }

  const handleRestore = async (restoreId: string) => {
    if (togglingId) {
      return
    }
    setTogglingId(restoreId)
    const prevItems = items
    const prevBaseline = baseline
    const body = mapNavMenuItemsToMasterRestore(items, restoreId)
    commitTree(setNavMenuItemDeleted(items, restoreId, false))
    try {
      await updateMasterNavMenu(body)
      notify(
        notifySuccess(t('nav_menu.restore_success', 'Menu item restored.'))
      )
    } catch (e) {
      console.error(e)
      setItems(prevItems)
      setBaseline(prevBaseline)
      notify(
        notifyError(
          getRequestErrorMessage(
            e,
            t('nav_menu.restore_failed', 'Failed to restore menu item.')
          )
        )
      )
    } finally {
      setTogglingId(null)
    }
  }

  const refreshStatus =
    isLoading || isSaving || togglingId !== null
      ? ComponentStatus.Disabled
      : ComponentStatus.Default

  return (
    <div className="panel panel-solid nav-menu-page">
      <div className="panel-heading">
        <div className="nav-menu-page--heading-row">
          <div>
            <h2 className="panel-title">
              {t('nav_menu.title', 'Nav Menu')}
            </h2>
            <p className="nav-menu-page--subtitle">
              {t(
                'nav_menu.save_guide',
                'The Active toggle is saved immediately. Icon, label, and order require Save layout.'
              )}
            </p>
          </div>
          <div className="nav-menu-page--heading-actions">
            <Button
              text={t('nav_menu.refresh', 'Refresh')}
              icon={IconFont.Refresh}
              color={ComponentColor.Default}
              size={ComponentSize.Small}
              onClick={load}
              status={refreshStatus}
            />
          </div>
        </div>
      </div>
      <div className="panel-body">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <NavMenuEditor
            items={items}
            iconOptions={NAV_MENU_ICON_OPTIONS}
            onChange={setItems}
            onSaveLayout={handleSaveLayout}
            onPersistDelete={handleDeleteApi}
            onPersistRestore={handleRestore}
            isDirty={isDirty}
            isSaving={isSaving}
            isBusy={isSaving}
          />
        )}
      </div>
    </div>
  )
}

const mapDispatchToProps = {
  notify: notifyAction,
}

export default connect(null, mapDispatchToProps)(NavMenuPage)
