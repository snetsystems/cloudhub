import React, {useEffect, useState} from 'react'
import {ImportSelectionPayload} from 'src/shared/types/importModal'
import {LibraryCell} from 'src/types/dashboards'
import {getLibraryCells} from 'src/dashboards/apis'
import {CellTypeIcon} from 'src/server_details/components/CellListIcons'
import ConfirmButton from 'src/shared/components/ConfirmButton'
import {Button, ComponentSize, IconFont} from 'src/reusable_ui'

interface CellListProps {
  onSelectionChange?: (items: ImportSelectionPayload) => void
  mode?: 'select' | 'manage'
  selectedItemId?: string
  onEditItem?: (item: LibraryCell) => void
  onDeleteItem?: (item: LibraryCell) => Promise<void> | void
  onItemsLoaded?: (items: LibraryCell[]) => void
}

function CellList({
  onSelectionChange,
  mode = 'select',
  selectedItemId,
  onEditItem,
  onDeleteItem,
  onItemsLoaded,
}: CellListProps) {
  const [items, setItems] = useState<LibraryCell[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getLibraryCells()
      .then(res => {
        if (!cancelled && res?.data?.libraryCells) {
          setItems(res.data.libraryCells)
          if (onItemsLoaded) {
            onItemsLoaded(res.data.libraryCells)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (mode !== 'select') {
      return
    }
    if (!selectedItemId) {
      return
    }
    setSelectedIds(new Set([selectedItemId]))
  }, [mode, selectedItemId])

  const handleToggle = (item: LibraryCell, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(item.id)
    } else {
      newSelected.delete(item.id)
    }
    setSelectedIds(newSelected)

    if (onSelectionChange) {
      const selectedItems = items.filter(i => newSelected.has(i.id))
      onSelectionChange({
        dashboards: [],
        cellTypes: [],
        libraryCells: selectedItems,
        templates: [],
        importStrategy: 'append',
      })
    }
  }

  if (loading) {
    return (
      <div className="fixedmodal-list" style={{padding: '8px'}}>
        <p
          style={{
            color: '#8b8f99',
            fontSize: '13px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Loading...
        </p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="fixedmodal-list" style={{padding: '8px'}}>
        <p
          style={{
            color: '#8b8f99',
            fontSize: '13px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          No library cells found.
        </p>
      </div>
    )
  }

  return (
    <div className="fixedmodal-list">
      {items.map(item => {
        const isHovered = hoveredId === item.id
        const isSelected =
          mode === 'manage'
            ? selectedItemId === item.id
            : selectedIds.has(item.id)

        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            className="fixedmodal-list-row"
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => {
              if (mode === 'select') {
                handleToggle(item, !isSelected)
                return
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (mode === 'select') {
                  handleToggle(item, !isSelected)
                  return
                }
              }
            }}
            style={{
              backgroundColor: isHovered ? '#31313d' : '#202028',
              cursor: 'pointer',
            }}
          >
            <div className="fixedmodal-list-row__inner">
              {mode === 'select' && (
                <div
                  className="fixedmodal-checkbox-wrapper fixedmodal-checkbox-wrapper--cell-list"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    id={`cell-item-checkbox-${item.id}`}
                    checked={isSelected}
                    onChange={e => {
                      e.stopPropagation()
                      handleToggle(item, e.target.checked)
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                  <label
                    htmlFor={`cell-item-checkbox-${item.id}`}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#383846',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                <CellTypeIcon type={item.type} />
              </div>

              <div style={{flex: 1, minWidth: 0}}>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: '13px',
                    color: isHovered ? '#eeeff2' : '#bec2cc',
                    marginBottom: '2px',
                    transition: 'color 0.25s ease',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.name}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: isHovered ? '#bec2cc' : '#8b8f99',
                    lineHeight: 1.4,
                    transition: 'color 0.25s ease',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={item.description || `Display as ${item.type}`}
                >
                  {item.description || `Display as ${item.type}`}
                </div>
              </div>
              {mode === 'manage' && (
                <div
                  className="cell-management-button"
                  onClick={e => e.stopPropagation()}
                >
                  <Button
                    icon={IconFont.Export}
                    titleText="Set this cell to Visualize"
                    size={ComponentSize.Small}
                    onClick={e => {
                      e.stopPropagation()
                      if (onEditItem) {
                        onEditItem(item)
                      }
                    }}
                  />
                  <ConfirmButton
                    icon={IconFont.Remove}
                    isHideText={true}
                    size={'btn-sm'}
                    type="btn-danger"
                    confirmText="Delete"
                    text=""
                    isEventStopPropagation={true}
                    confirmAction={async () => {
                      let deleted = true
                      if (onDeleteItem) {
                        try {
                          await onDeleteItem(item)
                        } catch {
                          deleted = false
                        }
                      }
                      if (deleted) {
                        setItems(prev =>
                          prev.filter(prevItem => prevItem.id !== item.id)
                        )
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CellList
