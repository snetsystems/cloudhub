import React from 'react'
import {connect} from 'react-redux'
import {generateForHosts} from 'src/utils/tempVars'
import {SERVER_DETAILS_PAGE_NAME} from 'src/shared/constants/routes'
import DashboardPageWithImport, {
  dashboardPageWithImportMstp,
  dashboardPageWithImportMdtp,
} from 'src/shared/components/DashboardPageWithImport'

function ServerDetailsWrapper(props) {
  return (
    <DashboardPageWithImport
      {...props}
      pageTitle="Server Details"
      pageName={SERVER_DETAILS_PAGE_NAME}
      getTempVars={generateForHosts}
      pageClassName="server-details-page"
      renderCell={(cell, context) => {
        if (cell.i === 'host-table-cell') {
          console.log(props, cell, context)
          return <div>Server Details</div>
        }
        return null
      }}
    />
  )
}

export default connect(
  dashboardPageWithImportMstp,
  dashboardPageWithImportMdtp
)(ServerDetailsWrapper)
