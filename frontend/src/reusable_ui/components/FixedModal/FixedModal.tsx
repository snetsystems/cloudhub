import React, {useRef, useState} from 'react'
import GraphOptionsToggleBtn from 'src/dashboards/components/GraphOptionsToggleBtn'
import DashboardList from 'src/server_details/components/DashboardList'
import CellList from 'src/server_details/components/CellList'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {Button, ComponentColor, ComponentSize} from 'src/reusable_ui'
import {ImportSelectionPayload} from 'src/shared/types/importModal'

const emptySelection = (): ImportSelectionPayload => ({
  dashboards: [],
  cellTypes: [],
  libraryCells: [],
  templates: [],
  importStrategy: 'append',
})

interface Props {
  onClose: () => void
  onSelectionChange?: (items: ImportSelectionPayload) => void
  width?: string
}

/** Mount only while open (`{open && <FixedModal />}`); unmount clears selection state. */
function FixedModal({onClose, onSelectionChange, width}: Props) {
  const [currentTab, setCurrentTab] = useState('dashboard-list')
  const selectionRef = useRef<ImportSelectionPayload>(emptySelection())

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab)
  }

  /** Merge per-tab fields so switching tabs keeps prior selections for Import. */
  const handleSelectionUpdate = (
    tab: 'dashboard-list' | 'cell-list',
    items: ImportSelectionPayload
  ) => {
    if (tab === 'dashboard-list') {
      selectionRef.current = {
        ...selectionRef.current,
        dashboards: items.dashboards,
        cellTypes: items.cellTypes,
        templates: items.templates,
        importStrategy: items.importStrategy,
      }
      return
    }

    selectionRef.current = {
      ...selectionRef.current,
      libraryCells: items.libraryCells,
    }
  }

  const handleImport = () => {
    if (onSelectionChange) {
      onSelectionChange(selectionRef.current)
    }
    onClose()
  }

  const tabOptions = [
    {
      title: 'Dashboards',
      value: 'dashboard-list',
      active: currentTab === 'dashboard-list',
      onClick: () => handleTabChange('dashboard-list'),
      titleText: 'Dashboard List',
    },
    {
      title: 'Cell library',
      value: 'cell-list',
      active: currentTab === 'cell-list',
      onClick: () => handleTabChange('cell-list'),
      titleText: 'Cell library',
    },
  ]

  return (
    <>
      <div
        className="modal-wrapper modal-wrapper--open"
        onClick={onClose}
      />
      <div
        className="modal-content modal-content--open"
        style={{width: width || '420px'}}
      >
        <div style={{padding: '16px', flexShrink: 0}}>
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '20px',
              color: '#8b8ba7',
              fontWeight: 500,
            }}
          >
            From existing resources
          </p>
          <GraphOptionsToggleBtn title="" GraphOptionsOptions={tabOptions} />
        </div>
        <FancyScrollbar
          autoHide={true}
          style={{
            flex: 1,
            minHeight: 0,
          }}
        >
          <div style={{padding: '0 16px 16px 16px'}}>
            {/* Keep both mounted so checkbox selection survives tab switches. */}
            <div
              style={{
                display: currentTab === 'dashboard-list' ? 'block' : 'none',
              }}
            >
              <DashboardList
                onSelectionChange={items =>
                  handleSelectionUpdate('dashboard-list', items)
                }
              />
            </div>
            <div
              style={{
                display: currentTab === 'cell-list' ? 'block' : 'none',
              }}
            >
              <CellList
                onSelectionChange={items =>
                  handleSelectionUpdate('cell-list', items)
                }
              />
            </div>
          </div>
        </FancyScrollbar>
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid #383846',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <Button
            text="Cancel"
            color={ComponentColor.Default}
            size={ComponentSize.Small}
            onClick={onClose}
          />
          <Button
            text="Import"
            color={ComponentColor.Primary}
            size={ComponentSize.Small}
            onClick={handleImport}
          />
        </div>
      </div>
    </>
  )
}

export default FixedModal
