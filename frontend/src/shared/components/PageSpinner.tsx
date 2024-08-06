import React, {FunctionComponent} from 'react'

interface PageSpinnerProps {
  customClass?: string
  pageSpinnerHeight?: string
}
const PageSpinner: FunctionComponent<PageSpinnerProps> = ({
  customClass = '',
  pageSpinnerHeight = '100%',
}) => {
  return (
    <div
      className={`${customClass} page-spinner-container`.trimLeft()}
      style={{height: pageSpinnerHeight}}
    >
      <div className="page-spinner" />
    </div>
  )
}

export default PageSpinner
