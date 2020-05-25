import React, {SFC} from 'react'

import AlertTabs from 'src/kapacitor/components/AlertTabs'

import {Kapacitor, Me, Source, Notification, NotificationFunc} from 'src/types'

interface Auth {
  me: Me
}

interface AlertOutputProps {
  exists: boolean
  kapacitor: Kapacitor
  source: Source
  auth: Auth
  hash: string
  notify: (message: Notification | NotificationFunc) => void
}

const AlertOutputs: SFC<AlertOutputProps> = ({
  hash,
  exists,
  source,
  auth,
  kapacitor,
  notify,
}) => {
  if (exists) {
    return (
      <AlertTabs
        hash={hash}
        source={source}
        auth={auth}
        kapacitor={kapacitor}
        notify={notify}
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
