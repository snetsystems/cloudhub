import _ from 'lodash'
import React from 'react'
import NoKapacitorError from 'src/shared/components/NoKapacitorError'
import PageSpinner from 'src/shared/components/PageSpinner'
import {Source, TimeRange} from 'src/types'
import {Alert} from 'src/types/alerts'
import PredictionAlertTableBody from './PredictionAlertTableBody'

interface Props {
  source: Source
  isWidget: boolean
  limit?: number
  timeRange?: TimeRange
  setLimitMultiplier: React.Dispatch<React.SetStateAction<number>>
  fetchAlerts: () => void
  error: unknown
  loading: boolean
  hasKapacitor: boolean
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
  loading,
  hasKapacitor,
  isAlertsMaxedOut,
  alerts,
}: Props) {
  const handleGetMoreAlerts = (): void => {
    setLimitMultiplier(prev => prev + 1)
    fetchAlerts()
  }

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

    if (loading || !source) {
      return <PageSpinner />
    }

    return hasKapacitor ? (
      <div
        style={{
          height: 'calc(100% - 45px)',
        }}
      >
        <PredictionAlertTableBody
          limit={limit}
          source={source}
          alerts={alerts}
          shouldNotBeFilterable={isWidget}
          onGetMoreAlerts={handleGetMoreAlerts}
          isAlertsMaxedOut={isAlertsMaxedOut}
          alertsCount={alerts.length}
        />
      </div>
    ) : (
      <NoKapacitorError source={source} />
    )
  }

  return <>{renderSubComponents()}</>
}

export default PredictionAlertTable
