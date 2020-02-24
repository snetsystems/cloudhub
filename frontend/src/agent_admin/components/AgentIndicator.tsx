import React from 'react'

export const OSIndicator = ({os}: {os: string}): JSX.Element => {
  return <span className={`os-icon os-${os.toLocaleLowerCase()}`}>{os}</span>
}
