import gql from 'graphql-tag'

export const GET_ALLROUTERS_INFO = gql`
  query routers_info($startTime: String, $endTime: String) {
    allRouters {
      nodes {
        name
        locationCoordinates
        managementConnected
        isHighlyAvailable
        bandwidth_avg: analytic(
          metric: BANDWIDTH
          transform: AVERAGE
          startTime: $startTime
          endTime: $endTime
        )
        session_cnt_avg: analytic(
          metric: SESSION_COUNT
          transform: AVERAGE
          startTime: $startTime
          endTime: $endTime
        )
        nodes {
          nodes {
            assetId
            enabled
            role
            cpu {
              core
              utilization
              type
            }
            memory {
              capacity
              usage
            }
            disk {
              capacity
              usage
              partition
            }
            state {
              status
              startTime
              softwareVersion
            }
          }
        }
        topSources {
          ip
          tenant
          currentBandwidth
          totalData
          sessionCount
        }
        topSessions {
          service
          tenant
          value
          protocol
          source {
            address
            port
          }
          destination {
            address
            port
            commonName
          }
        }
      }
    }
  }
`
