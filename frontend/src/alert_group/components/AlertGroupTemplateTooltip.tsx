import React from 'react'

interface Props {
  x: number
  y: number
  message: string
}

const AlertGroupTemplateTooltip = ({x, y, message}: Props) => (
  <div
    className="alert-group-template-tooltip"
    style={{
      left: x + 10,
      top: y,
    }}
  >
    {message}
  </div>
)

export default AlertGroupTemplateTooltip
