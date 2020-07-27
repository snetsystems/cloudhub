import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
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
import {closeShell} from 'src/shared/actions/shell'

import Shell from 'src/shared/components/Shell'
import {Notification} from 'src/types/notifications'
import {Links} from 'src/types'

interface Props {
  isVisible: boolean
  address: string
  headingTitle: string
  addr: string
  nodename: string
  links: Links
  closeShell: () => void
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
    const {
      isVisible,
      address,
      headingTitle,
      closeShell,

      nodename,
      notify,
    } = this.props
    return (
      <OverlayTechnology visible={isVisible}>
        <OverlayContainer maxWidth={840}>
          <OverlayHeading title={headingTitle} onDismiss={closeShell} />
          <OverlayBody>
            {isVisible ? (
              <ApolloProvider client={this.client}>
                <Shell addr={address} nodename={nodename} notify={notify} />
              </ApolloProvider>
            ) : null}
          </OverlayBody>
        </OverlayContainer>
      </OverlayTechnology>
    )
  }
}

const mapStateToProps = ({
  shell: {isVisible, address},
  sources,
  auth,
  links,
}) => ({
  isVisible,
  address,
  sources,
  auth,
  links,
})

const mapDispatchToProps = {
  closeShell: closeShell,
}

export default connect(mapStateToProps, mapDispatchToProps)(ShellModal)
