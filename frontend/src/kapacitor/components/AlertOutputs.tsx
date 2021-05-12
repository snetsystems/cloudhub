import React, {FunctionComponent} from 'react'

import AlertTabs from 'src/kapacitor/components/AlertTabs'

import {
  Kapacitor,
  Source,
  Notification,
  NotificationFunc,
  Me,
  Organization,
} from 'src/types'

interface AlertOutputProps {
  exists: boolean
  kapacitor: Kapacitor
  source: Source
  hash: string
  notify: (message: Notification | NotificationFunc) => void
  me: Me
  organizations: Organization[]
}

const AlertOutputs: FunctionComponent<AlertOutputProps> = ({
  hash,
  exists,
  source,
  kapacitor,
  notify,
  me,
  organizations,
}) => {
  if (exists) {
    return (
      <AlertTabs
        hash={hash}
        source={source}
        kapacitor={kapacitor}
        notify={notify}
        me={me}
        organizations={organizations}
      />
    )
  }

  return (
    <div className="panel">
      <div className="panel-heading">
        <h2 className="panel-title">Configure Alert Endpoints</h2>
      </div>
      <div className="panel-body">
        <div className="generic-empty-state">
          <h4 className="no-user-select">
            Connect to an active Kapacitor instance to configure alerting
            endpoints
          </h4>
        </div>
      </div>
    </div>
  )
}

export default AlertOutputs
