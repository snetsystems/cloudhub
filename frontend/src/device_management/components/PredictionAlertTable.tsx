import _ from 'lodash'
import React, {useMemo} from 'react'
import {Source, TimeRange} from 'src/types'
import {Alert} from 'src/types/alerts'
import PredictionAlertTableBody from './PredictionAlertTableBody'
import {alertValueStatus} from 'src/shared/utils/alertValueStatus'

interface Props {
  source: Source
  isWidget: boolean
  limit?: number
  timeRange?: TimeRange
  setLimitMultiplier: React.Dispatch<React.SetStateAction<number>>
  fetchAlerts: () => void
  error: unknown
  isAlertsMaxedOut: boolean
  alerts: Alert[]
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
        />
      </div>
    )
  }

  return <>{renderSubComponents()}</>
}

export default PredictionAlertTable
