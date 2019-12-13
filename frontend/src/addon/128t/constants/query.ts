import gql from 'graphql-tag'

export const GET_ALLROUTERS_INFO = gql`
  query routers_info {
    allRouters {
      nodes {
        name
        locationCoordinates
        managementConnected
        bandwidth_avg: analytic(metric: BANDWIDTH, transform: AVERAGE)
        session_arrivals: analytic(metric: SESSION_ARRIVAL_RATE, transform: SUM)
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
          }
        }
      }
    }
  }
`
