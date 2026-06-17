import React, {useCallback, useRef} from 'react'
import copy from 'copy-to-clipboard'
import {useDispatch} from 'react-redux'

import {notify} from 'src/shared/actions/notifications'
import {
  notifyCopyToClipboardFailed,
  notifyCopyToClipboardSuccess,
} from 'src/shared/copy/notifications'
interface SyslogCellPopoverContentProps {
  children: React.ReactNode
}

const SyslogCellPopoverContent: React.FC<SyslogCellPopoverContentProps> = ({
  children,
}) => {
  const dispatch = useDispatch()
  const contentRef = useRef<HTMLDivElement>(null)

  const resolveCopyText = useCallback(() => {
    return contentRef.current?.innerText?.trim() ?? ''
  }, [])

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()

      const text = resolveCopyText()
      const isSuccessful = Boolean(text) && copy(text)
      const preview = text ? `${text.slice(0, 30).trimRight()}...` : ''

      dispatch(
        notify(
          isSuccessful
            ? notifyCopyToClipboardSuccess(preview)
            : notifyCopyToClipboardFailed(preview)
        )
      )
    },
    [dispatch, resolveCopyText]
  )

  return (
    <div className="syslog-cell-popover">
      <div className="syslog-cell-popover__copy">
        <span
          className="icon copy"
          onClick={handleCopy}
          title="Copy to clipboard"
          aria-label="Copy to clipboard"
          role="button"
          tabIndex={0}
        />
      </div>
      <div ref={contentRef} className="syslog-cell-popover__content">
        {children}
      </div>
    </div>
  )
}

export default SyslogCellPopoverContent
