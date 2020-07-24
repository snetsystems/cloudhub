import React, {PureComponent} from 'react'
import {ApolloProvider} from '@apollo/react-hooks'
import ApolloClient from 'apollo-client'
import {InMemoryCache} from 'apollo-cache-inmemory'
import {createHttpLink} from 'apollo-link-http'
import {setContext} from 'apollo-link-context'

import {
  OverlayTechnology,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
} from 'src/reusable_ui'

import {AddonType} from 'src/shared/constants'

import Shell from 'src/agent_admin/components/Shell'
import {Notification} from 'src/types/notifications'
import {Links} from 'src/types'

interface Props {
  visible: boolean
  headingTitle: string
  addr: string
  nodename: string
  links: Links
  onCancel: () => void
  notify?: (message: Notification) => void
}

class ShellModal extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  private get client() {
    const addon = this.props.links.addons.find(addon => {
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

    return client
  }

  render() {
    const {visible, headingTitle, onCancel, addr, nodename, notify} = this.props
    return (
      <OverlayTechnology visible={visible}>
        <OverlayContainer maxWidth={840}>
          <OverlayHeading title={headingTitle} onDismiss={onCancel} />
          <OverlayBody>
            {visible ? (
              <ApolloProvider client={this.client}>
                <Shell addr={addr} nodename={nodename} notify={notify} />
              </ApolloProvider>
            ) : null}
          </OverlayBody>
        </OverlayContainer>
      </OverlayTechnology>
    )
  }
}

export default ShellModal
