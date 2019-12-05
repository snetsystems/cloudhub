import _ from 'lodash'
import React, {useState} from 'react'
import {useQuery} from '@apollo/react-hooks'

import {Page} from 'src/reusable_ui'

// Types
import {Router, TopSources} from 'src/types'

// Components
import Threesizer from 'src/shared/components/threesizer/Threesizer'
import RouterModal from 'src/addon/128t/components/RouterModal'
import PageSpinner from 'src/shared/components/PageSpinner'

// table
import RouterTable from 'src/addon/128t/components/RouterTable'
import TopSourcesTable from 'src/addon/128t/components/TopSourcesTable'

//const
import {GET_ALLROUTERS_INFO} from 'src/addon/128t/constants/query'
import {HANDLE_HORIZONTAL} from 'src/shared/constants'

interface RspData {
  routers: Router[]
  topSources: TopSources[]
}

interface Proportions {
  proportions: number[]
}

const SwanSdplexStatusPage = () => {
  const [proportions, setProportions] = useState<Proportions>({
    proportions: [0.65, 0.35],
  })
  const [rspData, setRoutersInfo] = useState<RspData>({
    routers: [
      {
        assetID: 'Router 1',
        routerStatus: 'Running',
        networkStatus: 'Up',
        ApplicationStatus: 'Running',
        cpu: 10,
        memory: 50,
        sdplexTrafficUsage: 10,
        config: '/etc/sdplex/configuration',
        firmware: '/etc/sdplex/configuration',
      },
      {
        assetID: 'Router 2',
        routerStatus: 'Running',
        networkStatus: 'Up',
        ApplicationStatus: 'Running',
        cpu: 20,
        memory: 20,
        sdplexTrafficUsage: 10,
        config: 'string',
        firmware: 'string',
      },
      {
        assetID: 'Router 3',
        routerStatus: 'Running',
        networkStatus: 'Up',
        ApplicationStatus: 'Running',
        cpu: 30,
        memory: 30,
        sdplexTrafficUsage: 10,
        config: 'string',
        firmware: 'string',
      },
    ],
    topSources: [
      {
        ip: '169.254.127.127',
        tenant: '_internal_',
        currentBandwidth: 3706,
        totalData: 1251214,
        sessionCount: 96,
      },
      {
        ip: '198.199.90.187',
        tenant: '<global>',
        currentBandwidth: 0,
        totalData: 166,
        sessionCount: 1,
      },
      {
        ip: '172.16.0.2',
        tenant: 'tenant-SDPLEX',
        currentBandwidth: 59,
        totalData: 85006,
        sessionCount: 910,
      },
      {
        ip: '63.240.240.74',
        tenant: '<global>',
        currentBandwidth: 0,
        totalData: 37474,
        sessionCount: 9,
      },
    ],
  })

  const {loading, data} = useQuery(GET_ALLROUTERS_INFO, {
    variables: {
      startTime: '2019-11-26T02:00:00',
      endTime: '2019-11-26T02:01:00',
    },
    errorPolicy: 'all',
  })

  const horizontalDivisions = () => {
    const [topSize, bottomSize] = _.get(proportions, 'proportions')

    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        render: () => {
          const {routers} = rspData
          return (
            <RouterTable
              routers={routers}
              onClickModal={({name, _this, onClickfn}) => {
                return (
                  <RouterModal
                    name={name}
                    targetObject={_this}
                    onClickfn={onClickfn}
                  />
                )
              }}
            />
          )
        },
        headerOrientation: HANDLE_HORIZONTAL,
        size: topSize,
      },
      {
        name: '',
        handlePixels: 8,
        headerButtons: [],
        menuOptions: [],
        render: () => {
          const {topSources} = rspData
          return <TopSourcesTable topSources={topSources} />
        },
        headerOrientation: HANDLE_HORIZONTAL,
        size: bottomSize,
      },
    ]
  }

  if (data) console.log({data})

  return (
    <Page className="hosts-list-page">
      <Page.Header fullWidth={true}>
        <Page.Header.Left>
          <Page.Title title="128T/SDPlex - Status" />
        </Page.Header.Left>
        <Page.Header.Right showSourceIndicator={true} />
      </Page.Header>
      <Page.Contents scrollable={true}>
        {loading ? (
          <PageSpinner />
        ) : (
          <Threesizer
            orientation={HANDLE_HORIZONTAL}
            divisions={horizontalDivisions()}
            onResize={(sizes: number[]) => {
              setProportions({proportions: sizes})
            }}
          />
        )}
      </Page.Contents>
    </Page>
  )
}

export default SwanSdplexStatusPage
