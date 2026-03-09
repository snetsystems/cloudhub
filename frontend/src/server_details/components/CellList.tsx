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
        <p className="fixed-modal-msg">Loading...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="fixedmodal-list" style={{padding: '8px'}}>
        <p className="fixed-modal-msg">No library cells found.</p>
      </div>
    )
  }

  return (
    <div className="fixedmodal-list">
      {items.map(item => {
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
              <div className="fixedmodal-list-row__icon-wrapper">
                <CellTypeIcon type={item.type} />
              </div>

              <div className="fixedmodal-list-row__name-wrapper">
                <div className="fixedmodal-list-row__name" title={item.name}>
                  {item.name}
                </div>

                <div
                  className="fixedmodal-list-row__description"
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
                        prev => prev.filter(prevItem => prevItem.id !== item.id)
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
