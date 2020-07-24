import gql from 'graphql-tag'

export const GET_ALLROUTERS_INFO = gql`
  query routers_info($names: [String]) {
    allNodes(names: $names) {
      nodes {
        router {
          name
          locationCoordinates
          managementConnected
          bandwidth_avg: analytic(metric: BANDWIDTH, transform: AVERAGE)
          session_arrivals: analytic(
            metric: SESSION_ARRIVAL_RATE
            transform: SUM
          )
          peers {
            nodes {
              name
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
        name
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
        deviceInterfaces {
          nodes {
            networkInterfaces {
              nodes {
                name
                addresses {
                  nodes {
                    ipAddress
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

export const GET_ROUTER_DEVICEINTERFACES_INFO = gql`
  query router_deviceinterfaces_info($name: String) {
    allNodes(name: $name) {
      nodes {
        name
        enabled
        deviceInterfaces {
          nodes {
            networkInterfaces {
              nodes {
                name
                addresses {
                  nodes {
                    ipAddress
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`
