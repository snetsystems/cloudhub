import React from 'react'
import classnames from 'classnames'

export const responseIndicator = (isEnabled: boolean): JSX.Element => {
  return (
    <span
      className={classnames('status-indicator', {
        'status-indicator--enabled': isEnabled,
      })}
    />
  )
}
