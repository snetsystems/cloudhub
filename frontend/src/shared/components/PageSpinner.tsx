import React, {FunctionComponent} from 'react'

interface PageSpinnerProps {
  customClass?: string
}
const PageSpinner: FunctionComponent<PageSpinnerProps> = ({
  customClass = '',
}) => {
  return (
    <div className={`${customClass} page-spinner-container`.trimLeft()}>
      <div className="page-spinner" />
    </div>
  )
}

export default PageSpinner
