import _ from 'lodash'
import React, {SFC} from 'react'
import {connect} from 'react-redux'
import {ApolloProvider} from '@apollo/react-hooks'
import ApolloClient from 'apollo-client'
import {InMemoryCache} from 'apollo-cache-inmemory'
import {createHttpLink} from 'apollo-link-http'
import {setContext} from 'apollo-link-context'

import {SwanSdplexStatusPage} from 'src/addon/128t'
import {SwanSdplexSettingPage} from 'src/addon/128t'

import {Addon} from 'src/types/auth'
import {AddonType} from 'src/shared/constants'

interface Props {
  page: string
  addons: Addon[]
}

const GraphqlProvider: SFC<Props> = (props: Props) => {
  const addon = props.addons.find(addon => {
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

  if (props.page === 'SwanSdplexStatusPage') {
    return (
      <ApolloProvider client={client}>
        <SwanSdplexStatusPage addons={props.addons} />
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

const mapStateToProps = ({links: {addons}}) => {
  return {addons}
}

export default connect(mapStateToProps, null)(GraphqlProvider)
