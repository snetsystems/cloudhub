import React, {useEffect, useState} from 'react'
import PredictionHexbin from './PredictionHexbin'
import AJAX from 'src/utils/ajax'
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
import NoKapacitorError from 'src/shared/components/NoKapacitorError'
import {notifyUnableToGetHosts} from 'src/shared/copy/notifications'

interface Props {
  onHexbinClick: (num: number) => void
  source: Source
  links?: Links
  auth?: Auth
  notify?: NotificationAction
}

function PredictionHexbinWrapper({onHexbinClick, source, auth, notify}: Props) {
  const [hostList, setHostList] = useState<PredictionTooltipNode[]>(null)

  const [hasKapacitor, setHasKapacitor] = useState(false)

  const [error, setError] = useState<unknown>()

  const [loading, setLoading] = useState<boolean>(false)

  // alert List get api
  useEffect(() => {
    AJAX({
      url: source.links?.kapacitors ?? '',
      method: 'GET',
    })
      .then(({data}) => {
        if (!!data.kapacitors[0]) {
          setHasKapacitor(true)
          fetchDeviceInfo()
        } else {
          setLoading(false)
        }
      })
      .catch(e => {
        notify(notifyUnableToGetHosts())
        setLoading(false)
        setError(e)
      })
  }, [])

  //TODO: timerange var change to redux data not props -> why?
  const fetchDeviceInfo = async () => {
    // const envVars = await getEnv(links.environment)

    // const telegrafSystemInterval = getDeep<string>(
    //   envVars,
    //   'telegrafSystemInterval',
    //   ''
    // )

    const tempVars = generateForHosts(source)
    const meRole = _.get(auth, 'me.role', '')

    getLiveDeviceInfo(source.links.proxy, source.telegraf, tempVars, meRole)
      .then(resp => {
        setHostList(resp)
        setError(false)
        setLoading(false)
      })
      .catch(e => {
        setError(e)
        setLoading(false)
      })
  }

  return (
    <>
      {loading ? (
        <>
          <div className="loading-container">
            <div className="page-spinner" />
          </div>
        </>
      ) : !hostList ? (
        <div>{error}</div>
      ) : hasKapacitor ? (
        <PredictionHexbin
          onHexbinClick={onHexbinClick}
          tooltipData={hostList}
        />
      ) : (
        <NoKapacitorError source={source} />
      )}
    </>
  )
}

const mstp = state => {
  const {
    app: {
      persisted: {autoRefresh},
      ephemeral: {inPresentationMode},
    },
    links,
    auth,
  } = state
  return {
    links,
    autoRefresh,
    inPresentationMode,
    auth,
  }
}

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(PredictionHexbinWrapper)