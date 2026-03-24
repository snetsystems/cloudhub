// Libraries
import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

// Types
import {
  Me,
  Source,
  TimeRange,
  TimeZones,
  RefreshRate,
  PredictionManualRefresh,
} from 'src/types'
import {Dashboard} from 'src/types/dashboards'
import {CloudAutoRefresh, CloudTimeRange} from 'src/clouds/types'

// Components
import WelcomePage from 'src/main/components/WelcomePage'
import LayoutRenderer from 'src/shared/components/LayoutRenderer'
import PageSpinner from 'src/shared/components/PageSpinner'
import SourceIndicator from 'src/shared/components/SourceIndicator'
import AutoRefreshDropdown from 'src/shared/components/dropdown_auto_refresh/AutoRefreshDropdown'
import TimeZoneToggle from 'src/shared/components/time_zones/TimeZoneToggle'
import TimeRangeDropdown from 'src/shared/components/TimeRangeDropdown'
import {Page} from 'src/reusable_ui'
import OrgDropdown from 'src/shared/components/OrgDropdown'

// Actions & APIs
import * as appActions from 'src/shared/actions/app'
import {setAutoRefresh} from 'src/shared/actions/app'
import {setCloudAutoRefresh} from 'src/clouds/actions'
import {setCloudTimeRange} from 'src/clouds/actions/clouds'
import {checkTelegrafData} from 'src/shared/apis/query'
import {getDashboards, getDefaultDashboards} from 'src/dashboards/apis'

// Utilities & Constants
import {isUserAuthorized, EDITOR_ROLE} from 'src/auth/Authorized'
import {createTimeRangeTemplates} from 'src/shared/utils/templates'
import {getTimeOptionByGroup} from 'src/clouds/constants/autoRefresh'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'
import {interval} from 'src/shared/constants'
import {CLOUD_TIME_RANGE} from 'src/shared/data/timeRanges'

interface OwnProps {
  source: Source
}

interface StateProps {
  me: Me
  timeZone: TimeZones
  autoRefresh: number
  cloudTimeRange: CloudTimeRange
  cloudAutoRefresh: CloudAutoRefresh
  setTimeZone: typeof appActions.setTimeZone
  onChooseAutoRefresh: (milliseconds: RefreshRate) => void
  onChooseCloudAutoRefresh: (autoRefreshGroup: CloudAutoRefresh) => void
  onChooseCloudTimeRange: (timeRange: CloudTimeRange) => void
}

type Props = OwnProps & StateProps

const fetchActiveDashboard = async (): Promise<Dashboard | undefined> => {
  try {
    const res = await getDashboards()
    const fetchedDashboards = res.data.dashboards || []

    try {
      const defaultRes = await getDefaultDashboards()
      const defaultDashboards = defaultRes.data.dashboards || []

      if (defaultDashboards.length > 0) {
        return defaultDashboards[0]
      }
    } catch (err) {
      console.error(err)
    }

    if (fetchedDashboards.length > 0) {
      return fetchedDashboards[0]
    }
  } catch (error) {
    console.error(error)
  }

  return undefined
}

const OverviewPage: React.FC<Props> = ({
  source,
  me,
  timeZone,
  autoRefresh,
  cloudTimeRange,
  cloudAutoRefresh,
  setTimeZone,
  onChooseAutoRefresh,
  onChooseCloudAutoRefresh,
  onChooseCloudTimeRange,
}) => {
  const [isFetching, setIsFetching] = useState<boolean>(true)
  const [hasTelegrafData, setHasTelegrafData] = useState<boolean>(false)
  const [dashboard, setDashboard] = useState<Dashboard>()
  const [
    manualRefreshState,
    setManualRefreshState,
  ] = useState<PredictionManualRefresh>({
    key: 'overview',
    value: Date.now(),
  })

  const handleChooseAutoRefresh = (option: {
    milliseconds: RefreshRate
    group?: string
  }) => {
    const {milliseconds, group} = option
    group
      ? onChooseCloudAutoRefresh({[group]: milliseconds})
      : onChooseAutoRefresh(milliseconds)
  }

  const handleChooseTimeRange = (timeRange: TimeRange) => {
    onChooseCloudTimeRange({overview: timeRange})
  }

  const handleManualRefresh = () => {
    setManualRefreshState({
      ...manualRefreshState,
      value: Date.now(),
    })
  }

  useEffect(() => {
    GlobalAutoRefresher.poll(cloudAutoRefresh.overview)
    return () => {
      GlobalAutoRefresher.stopPolling()
    }
  }, [cloudAutoRefresh.overview])

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const hasTelegraf = await checkTelegrafData(source)
        let activeDashboard: Dashboard | undefined

        if (hasTelegraf) {
          activeDashboard = await fetchActiveDashboard()
        }

        if (isMounted) {
          setHasTelegrafData(hasTelegraf)
          if (activeDashboard) {
            setDashboard(activeDashboard)
          }
        }
      } catch (error) {
        console.error(error)
      } finally {
        if (isMounted) {
          setIsFetching(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [source])

  const cells = React.useMemo(() => {
    if (!dashboard) return []

    return dashboard.cells.map(cell => {
      const dashboardCell = {
        ...cell,
        inView: true,
      }
      if (dashboardCell.queries) {
        dashboardCell.queries = dashboardCell.queries.map((q: any) => ({
          ...q,
          database: q.db,
          text: q.query,
          queryConfig: {
            ...q.queryConfig,
            rawText: q.query,
          },
        }))
      }
      return dashboardCell
    })
  }, [dashboard])

  const renderHeaderRight = () => {
    return (
      <>
        <SourceIndicator />
        <OrgDropdown />
        <AutoRefreshDropdown
          onChoose={handleChooseAutoRefresh}
          selected={autoRefresh}
          onManualRefresh={handleManualRefresh}
          customAutoRefreshOptions={getTimeOptionByGroup('overview')}
          customAutoRefreshSelected={cloudAutoRefresh}
        />
        <TimeRangeDropdown
          onChooseTimeRange={handleChooseTimeRange}
          selected={cloudTimeRange?.overview ?? CLOUD_TIME_RANGE.overview}
        />
        <TimeZoneToggle onSetTimeZone={setTimeZone} timeZone={timeZone} />
      </>
    )
  }

  if (isFetching) {
    return (
      <Page>
        <Page.Header fullWidth={true}>
          <Page.Header.Left>
            <Page.Title title="Overview" />
          </Page.Header.Left>
          <Page.Header.Right>{renderHeaderRight()}</Page.Header.Right>
        </Page.Header>
        <Page.Contents fullWidth={true} scrollable={true}>
          <PageSpinner />
        </Page.Contents>
      </Page>
    )
  }

  // 1. Telegraf 데이터가 없는 경우 (host tag check)
  if (!hasTelegrafData) {
    return <WelcomePage reason="no-hosts" />
  }

  // 2. Telegraf 데이터는 있지만 Dashboard가 0개인 경우
  if (!dashboard) {
    const isEditor = isUserAuthorized(me.role, EDITOR_ROLE)
    if (isEditor) {
      return <WelcomePage reason="no-dashboards-editor" sourceID={source.id} />
    } else {
      return <WelcomePage reason="no-dashboards-viewer" sourceID={source.id} />
    }
  }

  const {dashboardTime, upperDashboardTime} = createTimeRangeTemplates(
    cloudTimeRange.overview ?? CLOUD_TIME_RANGE.overview
  )

  const templatesIncludingDashTime = dashboard
    ? [...dashboard.templates, dashboardTime, upperDashboardTime, interval]
    : []

  return (
    <Page>
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="Overview" />
        </Page.Header.Left>
        <Page.Header.Right>{renderHeaderRight()}</Page.Header.Right>
      </Page.Header>
      <Page.Contents fullWidth={true} scrollable={true}>
        <>
          {/* dashboard */}
          <div className="dashboard container-fluid full-width">
            {cells.length > 0 && (
              <LayoutRenderer
                cells={cells}
                source={source}
                sources={[source]}
                isEditable={false}
                isStatusPage={false}
                isStaticPage={false}
                timeRange={cloudTimeRange.overview}
                manualRefresh={manualRefreshState.value}
                templates={templatesIncludingDashTime}
                host=""
              />
            )}
          </div>
        </>
      </Page.Contents>
    </Page>
  )
}

const mstp = ({
  app: {
    persisted: {timeZone, autoRefresh, cloudAutoRefresh, cloudTimeRange},
  },
  auth: {isUsingAuth, me},
}) => {
  return {
    isUsingAuth,
    me,
    timeZone,
    autoRefresh,
    cloudTimeRange,
    cloudAutoRefresh,
  }
}

const mdtp = dispatch => ({
  setTimeZone: bindActionCreators(appActions.setTimeZone, dispatch),
  onChooseAutoRefresh: bindActionCreators(setAutoRefresh, dispatch),
  onChooseCloudTimeRange: bindActionCreators(setCloudTimeRange, dispatch),
  onChooseCloudAutoRefresh: bindActionCreators(setCloudAutoRefresh, dispatch),
})

export default connect(mstp, mdtp, null)(OverviewPage)
