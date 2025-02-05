import React, {useMemo} from 'react'

// Library
import _ from 'lodash'

// Type
import {Source} from 'src/types'
import {Alert} from 'src/types/alerts'

// Components
import PredictionAlertTableBody from 'src/device_management/components/PredictionAlertTableBody'

// Utils
import {alertValueStatus} from 'src/shared/utils/alertValueStatus'

interface Props {
  source: Source
  isWidget: boolean
  limit?: number
  setLimitMultiplier: React.Dispatch<React.SetStateAction<number>>
  fetchAlerts: () => void
  error: unknown
  isAlertsMaxedOut: boolean
  alerts: Alert[]
  manualReset?: number
}

function PredictionAlertTable({
  source,
  isWidget,
  limit,
  setLimitMultiplier,
  fetchAlerts,
  error,
  isAlertsMaxedOut,
  alerts,
  manualReset,
}: Props) {
  const handleGetMoreAlerts = (): void => {
    setLimitMultiplier(prev => prev + 1)
    fetchAlerts()
  }

  const remakeAlert = useMemo(() => {
    return alerts.map(i => {
      return {
        ...i,
        ...{
          value: alertValueStatus(Number(i.value)),
        },
      }
    })
  }, [alerts])

  //tsx render
  const renderSubComponents = () => {
    if (error) {
      return (
        <>
          <div>{error.toString()}</div>
          <div>Check console logs.</div>
        </>
      )
    }

    return (
      <div
        style={{
          height: 'calc(100% - 45px)',
        }}
      >
        <PredictionAlertTableBody
          limit={limit}
          source={source}
          alerts={remakeAlert}
          shouldNotBeFilterable={isWidget}
          onGetMoreAlerts={handleGetMoreAlerts}
          isAlertsMaxedOut={isAlertsMaxedOut}
          alertsCount={alerts.length}
          manualReset={manualReset}
        />
      </div>
    )
  }

  return <>{renderSubComponents()}</>
}

export default PredictionAlertTable
