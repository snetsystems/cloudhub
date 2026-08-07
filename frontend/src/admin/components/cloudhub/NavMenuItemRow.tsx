import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  Dropdown,
  IconFont,
  Input,
  SlideToggle,
} from 'src/reusable_ui'
import type {
  NavMenuDragPayload,
  NavMenuIconOption,
  NavMenuItem,
} from 'src/admin/containers/cloudhub/NavMenuPage'

interface Props {
  item: NavMenuItem
  depth: number
  isLastSibling?: boolean
  parentId: string | null
  iconOptions: NavMenuIconOption[]
  isDragging?: boolean
  dragDisabled?: boolean
  toggleDisabled?: boolean
  onDragStart: (payload: NavMenuDragPayload) => void
  onDragEnd: () => void
  onDragHover: (hoverId: string, hoverParentId: string | null) => void
  onChangeLabel: (id: string, label: string) => void
  onChangeIcon: (id: string, icon: string | null) => void
  /** SlideToggle: on = active, off = soft-deleted (restore by turning on). */
  onToggleDeleted: (id: string) => void
  children?: React.ReactNode
}

const NavMenuItemRow = ({
  item,
  depth,
  isLastSibling = false,
  parentId,
  iconOptions,
  isDragging = false,
  dragDisabled = false,
  toggleDisabled = false,
  onDragStart,
  onDragEnd,
  onDragHover,
  onChangeLabel,
  onChangeIcon,
  onToggleDeleted,
  children,
}: Props) => {
  const {t} = useTranslation()
  const isTopLevel = depth === 0
  const isDeleted = item.deleted
  const disabled = item.locked || isDeleted
  const canDrag = !dragDisabled && !isDeleted
  const displayIcon = item.icon || iconOptions[0]?.id || 'cube'

  const dropdownOptions = useMemo(() => {
    if (!item.icon || iconOptions.some(o => o.id === item.icon)) {
      return iconOptions
    }
    return [{id: item.icon, label: item.icon}, ...iconOptions]
  }, [iconOptions, item.icon])

  const rowClass = [
    'nav-menu-row',
    isTopLevel ? 'nav-menu-row--top' : 'nav-menu-row--child',
    item.locked ? 'nav-menu-row--locked' : '',
    item.deleted ? 'nav-menu-row--deleted' : '',
    isLastSibling ? 'nav-menu-row--last' : '',
    isDragging ? 'nav-menu-row--dragging' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleDragStart = (e: React.DragEvent) => {
    if (!canDrag) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
    onDragStart({id: item.id, parentId})
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (dragDisabled || item.locked) {
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    onDragHover(item.id, parentId)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    onDragHover(item.id, parentId)
    onDragEnd()
  }

  return (
    <div
      className={rowClass}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="nav-menu-row--main">
        <div
          className={`nav-menu-row--drag${canDrag ? '' : ' is-disabled'}`}
          draggable={canDrag}
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          title={
            canDrag
              ? t('nav_menu.drag_title', 'Drag to reorder among siblings')
              : item.locked
                ? t('nav_menu.drag_locked', 'Locked')
                : t('nav_menu.drag_disabled', 'Cannot drag')
          }
          aria-label={t('nav_menu.drag_aria', 'Drag to reorder')}
        >
          <span className="hamburger" />
        </div>

        {isTopLevel && (
          <div className="nav-menu-row--icon-cell">
            <Dropdown
              selectedID={displayIcon}
              onChange={(next: string) => onChangeIcon(item.id, next)}
              buttonSize={ComponentSize.Small}
              buttonColor={ComponentColor.Default}
              customClass="nav-menu-row--icon-dropdown"
              titleText={t('nav_menu.select_icon', 'Select icon')}
              status={
                disabled ? ComponentStatus.Disabled : ComponentStatus.Default
              }
            >
              {dropdownOptions.map(opt => (
                <Dropdown.Item key={opt.id} id={opt.id} value={opt.id}>
                  <span className="nav-menu-row--icon-option">
                    <span className={`icon ${opt.id}`} />
                    <span>{opt.label}</span>
                  </span>
                </Dropdown.Item>
              ))}
            </Dropdown>
          </div>
        )}

        <div className="nav-menu-row--label-cell">
          <Input
            value={item.label}
            onChange={e => onChangeLabel(item.id, e.target.value)}
            status={
              disabled ? ComponentStatus.Disabled : ComponentStatus.Default
            }
            size={ComponentSize.Small}
            customClass="nav-menu-row--label-input"
          />
          <span className="nav-menu-row--id" title={item.id}>
            {item.id}
          </span>
        </div>

        <div className="nav-menu-row--meta">
          {item.locked && (
            <span
              className="nav-menu-row--lock"
              title={t('nav_menu.locked_title', 'System menu (locked)')}
            >
              <span className={`icon ${IconFont.CrownOutline}`} />
            </span>
          )}
          <SlideToggle
            active={!isDeleted}
            onChange={() => onToggleDeleted(item.id)}
            size={ComponentSize.ExtraSmall}
            disabled={item.locked || toggleDisabled}
            tooltipText={
              item.locked
                ? t('nav_menu.toggle_locked', 'System menu cannot be deleted')
                : isDeleted
                  ? t(
                      'nav_menu.toggle_restore',
                      'Deleted — toggle on to restore'
                    )
                  : t('nav_menu.toggle_delete', 'Toggle off to delete')
            }
          />
        </div>
      </div>

      {children ? (
        <div className="nav-menu-row--children">{children}</div>
      ) : null}
    </div>
  )
}

export default NavMenuItemRow
