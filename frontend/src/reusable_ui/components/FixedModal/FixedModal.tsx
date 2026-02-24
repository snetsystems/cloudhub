import React, {useEffect, useRef, useState} from 'react'
import GraphOptionsToggleBtn from 'src/dashboards/components/GraphOptionsToggleBtn'
import DashboardList from 'src/server_details/components/DashboardList'
import CellList from 'src/server_details/components/CellList'
import BuiltinTemplates from 'src/server_details/components/BuiltinTemplates'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {Button, ComponentColor, ComponentSize} from 'src/reusable_ui'
import {ImportSelectionPayload} from 'src/shared/types/importModal'

interface Props {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  children?: React.ReactNode
  width?: string
  onSelectionChange?: (items: ImportSelectionPayload) => void
  /** When set, Builtin tab shows only this builtin template (e.g. current page's builtin). */
  builtinName?: string
}

function FixedModal({
  isOpen,
  setIsOpen,
  children,
  width,
  onSelectionChange,
  builtinName,
}: Props) {
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)
  const [currentTab, setCurrentTab] = useState<string>('dashboard-list')
  const [selection, setSelection] = useState<ImportSelectionPayload>({
    dashboards: [],
    cellTypes: [],
    templates: [],
    importStrategy: 'append',
  })

  const selectionRef = useRef<ImportSelectionPayload>(selection)
  selectionRef.current = selection

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab)
  }

  const handleSelectionUpdate = (items: ImportSelectionPayload) => {
    const next: ImportSelectionPayload = {
      dashboards:
        items.dashboards.length > 0
          ? items.dashboards
          : selectionRef.current.dashboards,
      cellTypes:
        items.cellTypes.length > 0
          ? items.cellTypes
          : selectionRef.current.cellTypes,
      templates:
        items.templates.length > 0
          ? items.templates
          : selectionRef.current.templates,
      importStrategy:
        items.importStrategy ?? selectionRef.current.importStrategy,
    }
    selectionRef.current = next
    setSelection(next)
  }

  const handleImport = () => {
    if (onSelectionChange) {
      onSelectionChange(selectionRef.current)
    }
    setIsOpen(false)
  }

  const tabOptions = [
    {
      title: 'Dashboard List',
      value: 'dashboard-list',
      active: currentTab === 'dashboard-list',
      onClick: () => handleTabChange('dashboard-list'),
      titleText: 'Dashboard List',
    },
    {
      title: 'Cell List',
      value: 'cell-list',
      active: currentTab === 'cell-list',
      onClick: () => handleTabChange('cell-list'),
      titleText: 'Cell List',
    },
    {
      title: 'Builtin',
      value: 'builtin',
      active: currentTab === 'builtin',
      onClick: () => handleTabChange('builtin'),
      titleText: 'Builtin',
    },
  ]

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)

      requestAnimationFrame(() => {
        setIsVisible(true)
      })
      return
    }

    setIsVisible(false)

    const timeoutId = setTimeout(() => {
      setIsMounted(false)
    }, 250)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [isOpen])

  return (
    <>
      {children}
      {isMounted && (
        <>
          <div
            className={`modal-wrapper ${
              isVisible ? 'modal-wrapper--open' : 'modal-wrapper--closing'
            }`}
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`modal-content ${
              isVisible ? 'modal-content--open' : 'modal-content--closing'
            }`}
            style={{width: width || '420px'}}
          >
            <div style={{padding: '16px', flexShrink: 0}}>
              <GraphOptionsToggleBtn
                title=""
                GraphOptionsOptions={tabOptions}
              />
            </div>
            <FancyScrollbar
              key={currentTab}
              autoHide={true}
              style={{
                flex: 1,
                minHeight: 0,
              }}
            >
              <div style={{padding: '0 16px 16px 16px'}}>
                {currentTab === 'dashboard-list' && (
                  <DashboardList onSelectionChange={handleSelectionUpdate} />
                )}
                {currentTab === 'cell-list' && (
                  <CellList onSelectionChange={handleSelectionUpdate} />
                )}
                {currentTab === 'builtin' && (
                  <BuiltinTemplates
                    builtinName={builtinName}
                    onSelectionChange={handleSelectionUpdate}
                  />
                )}
                {children}
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
                onClick={() => setIsOpen(false)}
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
      )}
    </>
  )
}

export default FixedModal
