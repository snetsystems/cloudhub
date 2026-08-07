import React, {useCallback, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {
  Button,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  IconFont,
} from 'src/reusable_ui'
import NavMenuItemRow from 'src/admin/components/cloudhub/NavMenuItemRow'
import type {
  NavMenuDragPayload,
  NavMenuIconOption,
  NavMenuItem,
} from 'src/admin/containers/cloudhub/NavMenuPage'

interface Props {
  items: NavMenuItem[]
  iconOptions: NavMenuIconOption[]
  onChange: (items: NavMenuItem[]) => void
  onSaveLayout: () => void | Promise<void>
  onPersistDelete?: (id: string) => void | Promise<void>
  onPersistRestore?: (restoreId: string) => void | Promise<void>
  isDirty?: boolean
  isSaving?: boolean
  isBusy?: boolean
}

const renumber = (nodes: NavMenuItem[]): NavMenuItem[] =>
  nodes.map((node, index) => ({
    ...node,
    sortOrder: index + 1,
    children: renumber(node.children),
  }))

const updateNode = (
  nodes: NavMenuItem[],
  id: string,
  updater: (node: NavMenuItem) => NavMenuItem
): NavMenuItem[] =>
  nodes.map(node => {
    if (node.id === id) {
      return updater(node)
    }
    if (node.children.length) {
      return {...node, children: updateNode(node.children, id, updater)}
    }
    return node
  })

const reorderSiblingById = (
  nodes: NavMenuItem[],
  dragId: string,
  hoverId: string
): NavMenuItem[] => {
  const dragIdx = nodes.findIndex(n => n.id === dragId)
  const hoverIdx = nodes.findIndex(n => n.id === hoverId)
  if (dragIdx < 0 || hoverIdx < 0 || dragIdx === hoverIdx) {
    return nodes
  }
  if (nodes[dragIdx].locked || nodes[hoverIdx].locked) {
    return nodes
  }
  const next = [...nodes]
  const [moved] = next.splice(dragIdx, 1)
  next.splice(hoverIdx, 0, moved)
  return renumber(next)
}

export const reorderSiblings = (
  items: NavMenuItem[],
  parentId: string | null,
  dragId: string,
  hoverId: string
): NavMenuItem[] => {
  if (parentId === null) {
    return reorderSiblingById(items, dragId, hoverId)
  }
  return items.map(item => {
    if (item.id !== parentId) {
      return item
    }
    return {
      ...item,
      children: reorderSiblingById(item.children, dragId, hoverId),
    }
  })
}

const NavMenuEditor = ({
  items,
  iconOptions,
  onChange,
  onSaveLayout,
  onPersistDelete,
  onPersistRestore,
  isDirty = false,
  isSaving = false,
  isBusy = false,
}: Props) => {
  const {t} = useTranslation()
  const [showDeleted, setShowDeleted] = useState(true)
  const dragRef = useRef<NavMenuDragPayload | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const busyStatus = isBusy
    ? ComponentStatus.Disabled
    : ComponentStatus.Default

  const saveStatus =
    isBusy || !isDirty
      ? ComponentStatus.Disabled
      : ComponentStatus.Default

  const handleToggleDeleted = async (id: string) => {
    const findDeleted = (nodes: NavMenuItem[]): boolean | null => {
      for (const node of nodes) {
        if (node.id === id) {
          return node.deleted
        }
        const nested = findDeleted(node.children)
        if (nested !== null) {
          return nested
        }
      }
      return null
    }

    const currentlyDeleted = findDeleted(items)
    if (currentlyDeleted === null) {
      return
    }

    if (!currentlyDeleted) {
      if (onPersistDelete) {
        await onPersistDelete(id)
      } else {
        onChange(updateNode(items, id, n => ({...n, deleted: true})))
      }
      return
    }

    if (onPersistRestore) {
      await onPersistRestore(id)
    } else {
      onChange(updateNode(items, id, n => ({...n, deleted: false})))
    }
  }

  const handleDragStart = useCallback((payload: NavMenuDragPayload) => {
    dragRef.current = payload
    setDraggingId(payload.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragRef.current = null
    setDraggingId(null)
  }, [])

  const handleDragHover = useCallback(
    (hoverId: string, hoverParentId: string | null) => {
      const drag = dragRef.current
      if (!drag || drag.id === hoverId) {
        return
      }
      if (drag.parentId !== hoverParentId) {
        return
      }
      const next = reorderSiblings(items, drag.parentId, drag.id, hoverId)
      if (next !== items) {
        onChange(next)
      }
    },
    [items, onChange]
  )

  const renderTree = (
    nodes: NavMenuItem[],
    depth: number,
    parentId: string | null
  ): React.ReactNode => {
    const visibleNodes = showDeleted
      ? nodes
      : nodes.filter(node => !node.deleted)

    return visibleNodes.map((node, index) => {
      const childNodes = showDeleted
        ? node.children
        : node.children.filter(child => !child.deleted)

      return (
        <NavMenuItemRow
          key={node.id}
          item={node}
          depth={depth}
          isLastSibling={index === visibleNodes.length - 1}
          parentId={parentId}
          iconOptions={iconOptions}
          isDragging={draggingId === node.id}
          dragDisabled={isBusy || node.locked || node.deleted}
          toggleDisabled={isBusy}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragHover={handleDragHover}
          onChangeLabel={(itemId, label) =>
            onChange(updateNode(items, itemId, n => ({...n, label})))
          }
          onChangeIcon={(itemId, icon) =>
            onChange(updateNode(items, itemId, n => ({...n, icon})))
          }
          onToggleDeleted={handleToggleDeleted}
        >
          {childNodes.length > 0
            ? renderTree(childNodes, depth + 1, node.id)
            : null}
        </NavMenuItemRow>
      )
    })
  }

  return (
    <div className="nav-menu-editor">
      <div className="nav-menu-editor--section nav-menu-editor--section-layout">
        <div className="nav-menu-editor--section-header">
          <div className="nav-menu-editor--section-title">
            <h3>{t('nav_menu.section_title', 'Menu items')}</h3>
          </div>
          <div className="nav-menu-editor--section-actions">
            <Button
              text={
                showDeleted
                  ? t('nav_menu.hide_deleted', 'Hide Deleted')
                  : t('nav_menu.show_deleted', 'Show Deleted')
              }
              color={ComponentColor.Default}
              size={ComponentSize.Small}
              onClick={() => setShowDeleted(prev => !prev)}
              status={busyStatus}
            />
            <Button
              text={
                isSaving
                  ? t('nav_menu.saving', 'Saving…')
                  : t('nav_menu.save_layout', 'Save layout')
              }
              icon={IconFont.Checkmark}
              color={ComponentColor.Success}
              size={ComponentSize.Small}
              onClick={onSaveLayout}
              status={saveStatus}
              titleText={
                isDirty
                  ? t(
                      'nav_menu.save_layout_tooltip',
                      'Save label, icon, and order changes'
                    )
                  : t(
                      'nav_menu.save_layout_no_changes',
                      'No layout changes to save'
                    )
              }
            />
          </div>
        </div>

        <div className="nav-menu-editor--list">
          <div className="nav-menu-editor--header">
            <span className="nav-menu-editor--col-drag" />
            <span className="nav-menu-editor--col-icon">
              {t('nav_menu.col_icon', 'Icon')}
            </span>
            <span className="nav-menu-editor--col-label">
              {t('nav_menu.col_label', 'Label / ID')}
            </span>
            <span className="nav-menu-editor--col-actions">
              {t('nav_menu.col_active', 'Active')}
            </span>
          </div>
          {renderTree(items, 0, null)}
        </div>
      </div>
    </div>
  )
}

export default NavMenuEditor
