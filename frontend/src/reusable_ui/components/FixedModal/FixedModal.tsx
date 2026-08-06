import React, {useEffect, useState} from 'react'
import GraphOptionsToggleBtn from 'src/dashboards/components/GraphOptionsToggleBtn'
import DashboardList from 'src/server_details/components/DashboardList'
import CellList from 'src/server_details/components/CellList'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {Button, ComponentColor, ComponentSize} from 'src/reusable_ui'
import {ImportSelectionPayload} from 'src/shared/types/importModal'
import ImportSelectionPreview from './ImportSelectionPreview'

const emptySelection = (): ImportSelectionPayload => ({
  dashboards: [],
  cellTypes: [],
  libraryCells: [],
  templates: [],
  importStrategy: 'append',
})

/** Matches .modal-shell / .modal-wrapper transition duration. */
const SLIDE_MS = 300

interface Props {
  onClose: () => void
  onSelectionChange?: (items: ImportSelectionPayload) => void
  width?: string
  /** Active dashboard id — omitted from Dashboards import list. */
  excludeDashboardId?: string | number
}

/** Mount only while open (`{open && <FixedModal />}`); unmount clears selection state. */
function FixedModal({
  onClose,
  onSelectionChange,
  width,
  excludeDashboardId,
}: Props) {
  const [currentTab, setCurrentTab] = useState('dashboard-list')
  const [selection, setSelection] = useState<ImportSelectionPayload>(
    emptySelection()
  )
  const [entered, setEntered] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    // Enter from off-screen: paint closed state first, then open.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab)
  }

  /** Merge per-tab fields so switching tabs keeps prior selections for Import. */
  const handleSelectionUpdate = (
    tab: 'dashboard-list' | 'cell-list',
    items: ImportSelectionPayload
  ) => {
    setSelection(prev => {
      if (tab === 'dashboard-list') {
        return {
          ...prev,
          dashboards: items.dashboards,
          cellTypes: items.cellTypes,
          templates: items.templates,
          importStrategy: items.importStrategy,
        }
      }

      return {
        ...prev,
        libraryCells: items.libraryCells,
      }
    })
  }

  const requestClose = () => {
    if (exiting) {
      return
    }
    setExiting(true)
    setEntered(false)
    window.setTimeout(() => {
      onClose()
    }, SLIDE_MS)
  }

  const handleImport = () => {
    if (onSelectionChange) {
      onSelectionChange(selection)
    }
    requestClose()
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

  const drawerWidth = width || '420px'
  const openClass = entered && !exiting

  return (
    <>
      <div
        className={
          openClass
            ? 'modal-wrapper modal-wrapper--open'
            : exiting
              ? 'modal-wrapper modal-wrapper--closing'
              : 'modal-wrapper'
        }
        onClick={requestClose}
      />
      <div
        className={
          openClass
            ? 'modal-shell modal-shell--open'
            : exiting
              ? 'modal-shell modal-shell--closing'
              : 'modal-shell'
        }
        style={{['--drawer-width' as string]: drawerWidth}}
      >
        <ImportSelectionPreview selection={selection} />
        <div className="modal-content">
          <div className="modal-content__header">
            <p className="modal-content__title">From existing resources</p>
          </div>
          <div className="modal-content__tabs">
            <GraphOptionsToggleBtn title="" GraphOptionsOptions={tabOptions} />
          </div>
          <FancyScrollbar autoHide={true}>
            <div className="modal-content__body">
              {/* Keep both mounted so checkbox selection survives tab switches. */}
              <div
                className={
                  currentTab === 'dashboard-list'
                    ? 'modal-content__panel'
                    : 'modal-content__panel modal-content__panel--hidden'
                }
              >
                <DashboardList
                  onSelectionChange={items =>
                    handleSelectionUpdate('dashboard-list', items)
                  }
                  excludeDashboardId={excludeDashboardId}
                />
              </div>
              <div
                className={
                  currentTab === 'cell-list'
                    ? 'modal-content__panel'
                    : 'modal-content__panel modal-content__panel--hidden'
                }
              >
                <CellList
                  onSelectionChange={items =>
                    handleSelectionUpdate('cell-list', items)
                  }
                />
              </div>
            </div>
          </FancyScrollbar>
          <div className="modal-content__footer">
            <Button
              text="Cancel"
              color={ComponentColor.Default}
              size={ComponentSize.Small}
              onClick={requestClose}
            />
            <Button
              text="Import"
              color={ComponentColor.Primary}
              size={ComponentSize.Small}
              onClick={handleImport}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default FixedModal
