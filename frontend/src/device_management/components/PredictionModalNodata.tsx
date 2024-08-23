import React from 'react'

interface NoDataProps {
  message?: string
  margin?: string
}

export const NoData: React.FC<NoDataProps> = ({
  message = 'No Data.',
  margin = '90px 0',
}) => {
  return (
    <div className="generic-empty-state">
      <h4 style={{margin}}>{message}</h4>
    </div>
  )
}
