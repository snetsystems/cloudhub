import React, {useEffect, useState} from 'react'
import classnames from 'classnames'

interface Props {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  width?: number | string
  className?: string
}

function RightDrawerTechnology({
  isOpen,
  onClose,
  children,
  width,
  className,
}: Props) {
  const [isMounted, setIsMounted] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true)
      requestAnimationFrame(() => setIsVisible(true))
      return
    }
    setIsVisible(false)
    const timer = window.setTimeout(() => setIsMounted(false), 250)
    return () => clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isMounted) return null

  const widthStyle =
    width != null
      ? {width: typeof width === 'number' ? `${width}px` : width}
      : undefined

  return (
    <>
      <div
        className={classnames('modal-wrapper', {
          'modal-wrapper--open': isVisible,
          'modal-wrapper--closing': !isVisible,
        })}
        onClick={onClose}
        role="presentation"
      />
      <div
        className={classnames(
          'modal-content',
          className,
          isVisible ? 'modal-content--open' : 'modal-content--closing'
        )}
        style={widthStyle}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>
  )
}

export default RightDrawerTechnology
