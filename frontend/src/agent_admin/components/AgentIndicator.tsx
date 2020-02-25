import React from 'react'

export const OSIndicator = ({os}: {os: string}): JSX.Element => {
  if (os === undefined || os === null) {
    return <span>{os}</span>
  } else {
    return <span className={`os-icon os-${os.toLocaleLowerCase()}`}>{os}</span>
  }
}
