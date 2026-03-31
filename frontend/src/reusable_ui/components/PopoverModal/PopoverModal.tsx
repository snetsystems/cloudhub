import React, {useEffect, useRef, useState, useCallback, ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {Button, ComponentColor} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

export interface PopoverModalSection {
  /** Section label displayed above items (optional) */
  label?: string
  items: PopoverModalItem[]
}

export interface PopoverModalItem {
  id: string
  label: string
  type: 'checkbox' | 'radio' | 'text'
  checked?: boolean
  value?: string
  /** When true, a delete button is shown on this row. Only Flex Cells should have this. */
  deletable?: boolean
}

export interface PopoverModalProps {
  /** Whether the popover is visible */
  isOpen: boolean
  /** Callback to close the popover */
  onClose: () => void
  /** Title shown in the header */
  title: string
  /** Content sections (checkbox / radio rows). Override with `children` for fully custom content. */
  sections?: PopoverModalSection[]
  /** Called when OK is clicked. Receives current item states. */
  onConfirm?: (items: Record<string, boolean | string>) => void
  /** Width of the popover panel in px (default 280) */
  width?: number
  /** Custom content — replaces auto-generated section rows */
  children?: ReactNode
  /** Ref of the anchor element (button) to position relative to */
  anchorRef: React.RefObject<HTMLElement>
  /** Cancel button text (default 'Cancel') */
  cancelText?: string
  /** Confirm button text (default 'OK') */
  confirmText?: string
  /** Hide the footer action buttons */
  hideFooter?: boolean
  /** Called when a deletable item's delete button is clicked. Receives item id. */
  onDeleteItem?: (id: string) => void
  /** Optional tip or help icon to show in header */
  tip?: ReactNode
  /** Optional content to render at the top of the body, before sections */
  beforeBody?: ReactNode
}

interface Position {
  top: number
  left: number
}

/**
 * PopoverModal
 *
 * A reusable functional popover that anchors to an element (`anchorRef`),
 * opens below it, and auto-adjusts to stay within the viewport.
 *
 * Usage:
 * ```tsx
 * const btnRef = useRef<HTMLElement>(null)
 * const [open, setOpen] = useState(false)
 *
 * <button ref={btnRef} onClick={() => setOpen(v => !v)}>Open</button>
 * <PopoverModal
 *   anchorRef={btnRef}
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   title="Settings"
 *   sections={[{ label: 'Options', items: [{id: 'foo', label: 'Foo', type: 'checkbox', checked: true}] }]}
 *   onConfirm={(vals) => console.log(vals)}
 * />
 * ```
 */
function PopoverModal({
  isOpen,
  onClose,
  title,
  sections = [],
  onConfirm,
  width = 280,
  children,
  anchorRef,
  cancelText = 'Cancel',
  confirmText = 'OK',
  hideFooter = false,
  onDeleteItem,
  tip,
  beforeBody,
}: PopoverModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<Position>({top: 0, left: 0})

  // Track local checkbox/radio state derived from sections
  const [localValues, setLocalValues] = useState<
    Record<string, boolean | string>
  >(() => initValues(sections))

  // Re-sync when sections prop changes (e.g., parent updates prop values)
  useEffect(() => {
    setLocalValues(initValues(sections))
  }, [sections])

  // Mount / unmount with animation
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
    } else {
      setIsVisible(false)
      const id = setTimeout(() => setIsMounted(false), 200)
      return () => clearTimeout(id)
    }
  }, [isOpen])

  const computePosition = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const panelH = panelRef.current?.offsetHeight ?? 300
    const panelW = width

    const GAP = 6
    let top = rect.bottom + GAP
    let left = rect.right - panelW

    // keep within bottom edge
    if (top + panelH > window.innerHeight - 8) {
      top = rect.top - panelH - GAP
    }
    // keep within right edge
    if (left < 8) left = 8
    // keep within left edge
    if (left + panelW > window.innerWidth - 8) {
      left = window.innerWidth - panelW - 8
    }

    setPosition({top, left})
  }, [anchorRef, width])

  useEffect(() => {
    if (isOpen) {
      computePosition()
    }
  }, [isOpen, computePosition])

  // Recompute on resize
  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('resize', computePosition)
    return () => window.removeEventListener('resize', computePosition)
  }, [isOpen, computePosition])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onClose, anchorRef])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleItemChange = (id: string, value: boolean | string) => {
    setLocalValues(prev => ({...prev, [id]: value}))
  }

  const handleConfirm = () => {
    onConfirm?.(localValues)
    onClose()
  }

  if (!isMounted) return null

  const panel = (
    <div
      ref={panelRef}
      className={`popover-modal ${
        isVisible ? 'popover-modal--open' : 'popover-modal--closing'
      }`}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width,
        zIndex: 9990,
      }}
    >
      {/* Header */}
      <div className="popover-modal__header">
        <div className="popover-modal__title-section">
          <span className="popover-modal__title">{title}</span>
          {tip && <div className="popover-modal__header-tip">{tip}</div>}
        </div>
        <button
          className="popover-modal__close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <span className="icon remove" />
        </button>
      </div>

      {/* Body */}
      <FancyScrollbar autoHeight maxHeight="min(500px, 50vh)">
        <div className="popover-modal__body">
          {beforeBody}
          {children
            ? children
            : sections.map((section, si) => (
                <div key={si} className="popover-modal__section">
                  {section.label && (
                    <div className="popover-modal__section-label">
                      {section.label}
                    </div>
                  )}
                  {section.items.map(item => (
                    <div key={item.id} className="popover-modal__item">
                      {item.type === 'checkbox' && (
                        <div className="popover-modal__item-row form-control-static">
                          <input
                            id={`pm-${item.id}`}
                            type="checkbox"
                            checked={!!(localValues[item.id] ?? item.checked)}
                            onChange={e =>
                              handleItemChange(item.id, e.currentTarget.checked)
                            }
                          />
                          <label htmlFor={`pm-${item.id}`}>{item.label}</label>

                          {item.deletable && onDeleteItem && (
                            <button
                              className="popover-modal__item-delete-btn"
                              onClick={() => onDeleteItem(item.id)}
                              title={`Delete ${item.label}`}
                              aria-label={`Delete ${item.label}`}
                            >
                              <span className="icon remove" />
                            </button>
                          )}
                        </div>
                      )}
                      {item.type === 'radio' && (
                        <div className="popover-modal__item-row form-control-static">
                          <input
                            id={`pm-${item.id}`}
                            type="radio"
                            checked={!!(localValues[item.id] ?? item.checked)}
                            onChange={() => handleItemChange(item.id, true)}
                          />
                          <label htmlFor={`pm-${item.id}`}>{item.label}</label>
                        </div>
                      )}
                      {item.type === 'text' && (
                        <span className="popover-modal__item-text">
                          {item.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
        </div>
      </FancyScrollbar>

      {/* Footer */}
      {!hideFooter && (
        <div className="popover-modal__footer">
          <Button
            text={cancelText}
            color={ComponentColor.Default}
            onClick={onClose}
            customClass="popover-modal__footer-btn"
          />
          <Button
            text={confirmText}
            color={ComponentColor.Primary}
            onClick={handleConfirm}
            customClass="popover-modal__footer-btn"
          />
        </div>
      )}
    </div>
  )

  return createPortal(panel, document.body)
}

function initValues(
  sections: PopoverModalSection[]
): Record<string, boolean | string> {
  const result: Record<string, boolean | string> = {}
  sections.forEach(sec => {
    sec.items.forEach(item => {
      if (item.type === 'checkbox' || item.type === 'radio') {
        result[item.id] = item.checked ?? false
      } else if (item.value !== undefined) {
        result[item.id] = item.value
      }
    })
  })
  return result
}

export default PopoverModal
