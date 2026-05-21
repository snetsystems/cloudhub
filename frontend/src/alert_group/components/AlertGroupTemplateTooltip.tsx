import React from 'react'
import ReactDOM from 'react-dom'

interface Props {
  x: number
  y: number
  message: string
}

const AlertGroupTemplateTooltip = ({x, y, message}: Props) => {
  return ReactDOM.createPortal(
    <div
      className="alert-group-template-tooltip"
      style={{
        left: x + 10,
        top: y,
      }}
    >
      {message}
    </div>,
    document.body
  )
}

export default AlertGroupTemplateTooltip
