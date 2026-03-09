import React from 'react'
import {connect} from 'react-redux'
import {generateForHosts} from 'src/utils/tempVars'
import {SERVER_OVERVIEW_PAGE_NAME} from 'src/shared/constants/routes'
import DashboardPageWithImport, {
  dashboardPageWithImportMstp,
  dashboardPageWithImportMdtp,
  type DashboardPageWithImportProps,
} from 'src/shared/components/DashboardPageWithImport'

type Props = DashboardPageWithImportProps

function OverviewPage(props: Props) {
  return (
    <DashboardPageWithImport
      {...props}
      pageTitle="Server Monitoring Overview"
      pageName={SERVER_OVERVIEW_PAGE_NAME}
      getTempVars={generateForHosts}
      pageClassName="server-overview-page"
      showEmptyState={false}
    />
  )
}

const mstp = state => ({...dashboardPageWithImportMstp(state)})
export default connect(mstp, dashboardPageWithImportMdtp)(OverviewPage as any)
