import React, {useEffect, useState} from 'react'
import PredictionHexbin from './PredictionHexbin'
import {
  Links,
  NotificationAction,
  PredictionTooltipNode,
  Source,
} from 'src/types'
import {getLiveDeviceInfo} from '../apis'
import {generateForHosts} from 'src/utils/tempVars'
import {Auth} from 'src/types/reducers/auth'

import {bindActionCreators} from 'redux'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {connect} from 'react-redux'
import _ from 'lodash'
import {PredictionModal} from './PredictionModal'
import PredictionDashboardHeader from './PredictionDashboardHeader'
import {
  DEFAULT_CELL_BG_COLOR,
  DEFAULT_CELL_TEXT_COLOR,
} from 'src/dashboards/constants'
import LoadingDots from 'src/shared/components/LoadingDots'
import {CloudAutoRefresh} from 'src/clouds/types/type'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {setFilteredHexbin} from '../actions'
import {notifyPredictionHexbinGetFailed} from 'src/shared/copy/notifications'

interface Props {
  source: Source
  links?: Links
  auth?: Auth
  notify?: NotificationAction
  cloudAutoRefresh?: CloudAutoRefresh
  setFilteredHexbin?: (value: string) => void
}

function PredictionHexbinWrapper({
  source,
  auth,
  cloudAutoRefresh,
  notify,
  setFilteredHexbin,
}: Props) {
  const [hostList, setHostList] = useState<PredictionTooltipNode[]>(null)

  const [error, setError] = useState<string>()

  const [loading, setLoading] = useState<boolean>(true)

  const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false)

  const [openNum, setOpenNum] = useState<number>(null)

  let intervalID

  useEffect(() => {
    fetchDeviceInfo()
  }, [])

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.prediction)
    const controller = new AbortController()

    if (!!cloudAutoRefresh.prediction) {
      clearInterval(intervalID)
      intervalID = window.setInterval(() => {
        fetchDeviceInfo()
      }, cloudAutoRefresh.prediction)
    }

    GlobalAutoRefresher.poll(cloudAutoRefresh.prediction)

    return () => {
      controller.abort()
      clearInterval(intervalID)
      intervalID = null
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh])

  const onHexbinClick = (
    num: number,
    host: string,
    filteredHexbinHost?: string
  ) => {
    // the way to close modal is hexbin double click

    if (filteredHexbinHost === host) {
      setIsPredictionModalOpen(prev => !prev)
      setFilteredHexbin('')
    } else {
      setOpenNum(num)
      setIsPredictionModalOpen(true)
      setFilteredHexbin(host)
    }
  }

  //TODO: timerange var change to redux data not props -> why?
  const fetchDeviceInfo = async () => {
    const tempVars = generateForHosts(source)
    const meRole = _.get(auth, 'me.role', '')
    try {
      getLiveDeviceInfo(source.links.proxy, source.telegraf, tempVars, meRole)
        .then(resp => {
          setHostList(resp)
          setError(null)
          setLoading(false)
        })
        .catch(e => {
          setError('Hexbin Chart Error')
          setLoading(false)
          console.log(e)
        })
    } catch (e) {
      setError('Hexbin Chart Error')
      notify(notifyPredictionHexbinGetFailed(e))
      setLoading(false)
      console.log(e)
    }
  }

  return (
    <>
      <div style={{height: '100%', backgroundColor: '#292933'}}>
        <PredictionDashboardHeader
          cellName={`Nodes Health Status`}
          cellBackgroundColor={DEFAULT_CELL_BG_COLOR}
          cellTextColor={DEFAULT_CELL_TEXT_COLOR}
        >
          <div className="dash-graph--name">
            {loading && (
              <LoadingDots
                className={'graph-panel__refreshing openstack-dots--loading'}
              />
            )}
          </div>
        </PredictionDashboardHeader>

        {!hostList || error ? (
          <div>{error}</div>
        ) : (
          <PredictionHexbin
            onHexbinClick={onHexbinClick}
            tooltipData={hostList}
          />
        )}
        {
          <PredictionModal
            isOpen={isPredictionModalOpen}
            setIsOpen={setIsPredictionModalOpen}
            index={openNum}
          />
        }
      </div>
    </>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {cloudAutoRefresh},
      ephemeral: {inPresentationMode},
    },
    links,
    auth,
  } = state
  return {
    links,
    cloudAutoRefresh,
    inPresentationMode,
    auth,
  }
}

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
  setFilteredHexbin: bindActionCreators(setFilteredHexbin, dispatch),
})

export default connect(mstp, mdtp, null)(PredictionHexbinWrapper)
