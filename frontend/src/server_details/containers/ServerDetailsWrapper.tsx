import React, {useState} from 'react'
import {connect} from 'react-redux'
import {generateForHosts} from 'src/utils/tempVars'
import {SERVER_DETAILS_PAGE_NAME} from 'src/shared/constants/routes'
import DashboardPageWithImport, {
  dashboardPageWithImportMstp,
  dashboardPageWithImportMdtp,
} from 'src/shared/components/DashboardPageWithImport'

function ServerDetailsCellContent() {
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info')
  return (
    <div className="server-details-cell-content">
      <div className="dash-graph--draggable dash-graph--heading dash-graph--heading-draggable server-details-cell-header">
        <div className="server-details-cell-tab-buttons">
          <button
            type="button"
            className={activeTab === 'info' ? 'active' : ''}
            onClick={() => setActiveTab('info')}
          >
            Server Info
          </button>
          <button
            type="button"
            className={activeTab === 'files' ? 'active' : ''}
            onClick={() => setActiveTab('files')}
          >
            File System
          </button>
        </div>
        <div className="server-details-cell-drag-handle">
          <div className="dash-graph--heading-bar" />
          <div className="dash-graph--heading-dragger" />
        </div>
      </div>
      <div className="server-details-cell-tabs">
        <div className="server-details-cell-tab-panel">
          {activeTab === 'info' && (
            <div className="server-details-cell-tab-body">서버 정보 내용~</div>
          )}
          {activeTab === 'files' && (
            <div className="server-details-cell-tab-body">파일 시스템 내용</div>
          )}
        </div>
      </div>
    </div>
  )
}

function ServerDetailsWrapper(props) {
  return (
    <DashboardPageWithImport
      {...props}
      pageTitle="Server Details"
      pageName={SERVER_DETAILS_PAGE_NAME}
      getTempVars={generateForHosts}
      pageClassName="server-details-page"
      draggableCancel=".server-details-cell-tab-buttons"
      renderCell={(cell, _context) => {
        const cellId = (cell.i || '').trim()
        if (cellId === 'host-table-cell') {
          return <ServerDetailsCellContent />
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
