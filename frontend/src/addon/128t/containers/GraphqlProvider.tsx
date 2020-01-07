import _ from 'lodash'
import React, {SFC} from 'react'
import {ApolloProvider} from '@apollo/react-hooks'
import ApolloClient from 'apollo-client'
import {InMemoryCache} from 'apollo-cache-inmemory'
import {createHttpLink} from 'apollo-link-http'
import {setContext} from 'apollo-link-context'

import {SwanSdplexStatusPage} from 'src/addon/128t'
import {SwanSdplexSettingPage} from 'src/addon/128t'

const graphqlUri = 'https://211.189.153.40/api/v1/graphql'
const loginToken =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiYWRtaW4iLCJzY29wZXMiOlsiY29uZmlndXJlIl0sImlhdCI6MTU3NDAzNjAxM30.beW77E48pOhNKHNuFB6q343hg5XGbV7HzUcI-8LaV4RJTOiOALpA4NPWF4nDmFcveVuGuH8rETnLNbeXFa2zmssbCg_TfaAt49yyq_Meg43TYXKOYl5pl7mJ1k-nte0zW4fX2J6brRE5ouvU3e2ssvRVmvsnuqWxdQ1Doqm4e2zLaVIblMsb80DpSr7AZfbF5Ld11KwUPIxAsU7LIN_tfKfy4-LPqwN78eD6fGcb_u6m2sm5jVZihuwKmzhIVEVIHtnGbr2oSrAHLrpeokLCGctXF1b7pCt7pCWIeBqyr7EjjOx90d8LoH49idMPLymDR_NPi-8Cs0GXszJtW82DuA'

interface Props {
  page: string
}

const GraphqlProvider: SFC<Props> = page => {
  const httpLink = createHttpLink({
    uri: graphqlUri,
  })

  const authLink = setContext((_, {headers}) => {
    const token = loginToken
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : '',
      },
      // fetchOptions: {
      //   rejectUnauthorized: false,
      //   // requestCert: true,
      //   // agent: false,
      //   // strictSSL: false,
      // },
    }
  })

  const client = new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
  })

  if (_.get(page, 'page') === 'SwanSdplexStatusPage') {
    return (
      <ApolloProvider client={client}>
        <SwanSdplexStatusPage />
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

export default GraphqlProvider
