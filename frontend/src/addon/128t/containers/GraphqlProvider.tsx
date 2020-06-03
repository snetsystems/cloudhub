import _ from 'lodash'
import React, {SFC, useState, useEffect} from 'react'
import {connect} from 'react-redux'
import {ApolloProvider} from '@apollo/react-hooks'
import ApolloClient from 'apollo-client'
import {InMemoryCache} from 'apollo-cache-inmemory'
import {createHttpLink} from 'apollo-link-http'
import {setContext} from 'apollo-link-context'

import {SwanSdplexStatusPage} from 'src/addon/128t'
import {SwanSdplexSettingPage} from 'src/addon/128t'

import {AddonType} from 'src/shared/constants'

// Types
import {Source, Links, Organization} from 'src/types'
import {HostNames} from 'src/types/hosts'

// Actions
import {
  getAllHostsAsync,
  getAllHostsAndStatusAsync,
} from 'src/addon/128t/actions'

// Constants
import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

interface HostsObject {
  [x: string]: Host
}

export interface Host {
  name: string
  deltaUptime?: number
  winDeltaUptime?: number
}

interface GroupHosts {
  name: string
  hosts: HostsObject
}

interface Props {
  page: string
  links: Links
  meRole: string
  source: Source
  sources: Source[]
  handleGetAllHosts: (source: Source) => Promise<HostNames>
  handleGetAllAddonHosts: (source: Source) => Promise<HostsObject>
  organizations: Organization[]
}

const GraphqlProvider: SFC<Props> = (props: Props) => {
  const addon = props.links.addons.find(addon => {
    return addon.name === AddonType.router128T
  })

  const httpLink = createHttpLink({
    uri: addon.url,
  })

  const authLink = setContext((_, {headers}) => {
    const token = addon.token
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
      },
    }
  })

  const client = new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
  })

  const [groupHosts, setGroupHosts] = useState<GroupHosts[]>([])

  if (!isUserAuthorized(props.meRole, SUPERADMIN_ROLE)) {
    useEffect(() => {
      let gHosts: GroupHosts[] = []
      const getAllHost = async () => {
        const pSource: Source = props.source
        const promiseHost = await props.handleGetAllAddonHosts(pSource)
        gHosts.push({
          name: pSource.telegraf,
          hosts: promiseHost,
        })
        setGroupHosts(gHosts)
      }

      getAllHost()
    }, [])
  } else {
    useEffect(() => {
      let gHosts: GroupHosts[] = []
      const getAllHost = async () => {
        for (const k of props.organizations) {
          let pSource: Source = props.source
          pSource = {
            ...pSource,
            // telegraf: k.name === 'Default' ? 'telegraf' : k.name,
            telegraf: k.name,
          }
          const promiseHost = await props.handleGetAllAddonHosts(pSource)
          gHosts.push({
            name: k.name,
            hosts: promiseHost,
          })
        }
        setGroupHosts(gHosts)
      }

      getAllHost()
    }, [])
  }

  if (props.page === 'SwanSdplexStatusPage') {
    return (
      <ApolloProvider client={client}>
        <SwanSdplexStatusPage
          addons={props.links.addons}
          meRole={props.meRole}
          groupHosts={groupHosts}
        />
      </ApolloProvider>
    )
  } else {
    return (
      <ApolloProvider client={client}>
        <SwanSdplexSettingPage />
      </ApolloProvider>
    )
  }
}

const mapStateToProps = ({
  auth: {me},
  links,
  adminCloudHub: {organizations},
}) => {
  const meRole = _.get(me, 'role', null)
  return {meRole, links, organizations}
}

const mdtp = {
  handleGetAllHosts: getAllHostsAsync,
  handleGetAllAddonHosts: getAllHostsAndStatusAsync,
}

export default connect(mapStateToProps, mdtp)(GraphqlProvider)
