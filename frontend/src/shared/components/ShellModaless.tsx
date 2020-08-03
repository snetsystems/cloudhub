import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {ApolloProvider} from '@apollo/react-hooks'
import ApolloClient from 'apollo-client'
import {InMemoryCache} from 'apollo-cache-inmemory'
import {createHttpLink} from 'apollo-link-http'
import {setContext} from 'apollo-link-context'
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'
import {Rnd} from 'react-rnd'

import 'react-tabs/style/react-tabs.css'

import {AddonType} from 'src/shared/constants'
import {
  closeShell,
  removeShell,
  addShell,
  updateShell,
  indexShell,
} from 'src/shared/actions/shell'

import Shell from 'src/shared/components/Shell'
import {Notification} from 'src/types/notifications'
import {notify as notifyAction} from 'src/shared/actions/notifications'

import {Links, ShellInfo} from 'src/types'

interface Props {
  isVisible: boolean
  shells: ShellInfo[]
  tabIndex: number
  headingTitle: string
  links: Links
  closeShell: () => void
  removeShell: (nodeName: string) => void
  addShell: (shell: ShellInfo) => void
  updateShell: (shell: ShellInfo) => void
  indexShell: (tabIndex: number) => void
  notify?: (message: Notification) => void
}

interface State {
  tabCount: number
  onTabNameRefreshFlag: boolean
}

var _self
class ShellModaless extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      tabCount: 0,
      onTabNameRefreshFlag: false,
    }
    _self = this
  }

  private isExistInLinks = (name: string): boolean => {
    const {links} = this.props
    return links.addons &&
      links.addons.findIndex(item => {
        return item.name === name
      }) !== -1
      ? true
      : false
  }

  private onAddTabClick() {
    const {tabCount} = this.state
    this.props.addShell({
      isNewEditor: true,
      nodename: 'Untitled_' + tabCount,
    })
    this.setState(prevState => ({tabCount: prevState.tabCount + 1}))
  }

  private onTabNameRefresh() {
    _self.setState(prevState => ({
      onTabNameRefreshFlag: !prevState.onTabNameRefreshFlag,
    }))
  }

  private get client() {
    const addon = this.props.links.addons.find(addon => {
      return addon.name === AddonType.router128T
    })

    const httpLink = createHttpLink({
      uri: addon ? addon.url : '',
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
    const {isVisible, shells, notify, tabIndex, indexShell} = this.props
    return (
      <div
        className={`shell-container`}
        style={{display: isVisible ? 'block' : 'none'}}
      >
        <Rnd
          className={`overlay--body`}
          default={{
            x: 25,
            y: 25,
            width: 800,
            height: 600,
          }}
        >
          <div className={`shell-container`}>
            <div className={`page-header`}>
              <div className={`page-header--container`}>
                <div className={`page-header--left`}>
                  <div className={`page-header--title`}>Terminal</div>
                </div>
                <div className={`page-header--right`}>
                  <button
                    className={`button button-sm button-default button-square icon minimize`}
                    onClick={this.props.closeShell}
                  />
                </div>
              </div>
            </div>
            <div className={`container-fluid`}>
              <Tabs
                forceRenderTabPanel={true}
                onSelect={(tabIndex: number) => indexShell(tabIndex)}
                selectedIndex={tabIndex}
              >
                <TabList>
                  {shells.map(shell => {
                    return (
                      <Tab key={shell.tabkey}>
                        <span
                          className="text-ellipsis"
                          style={{marginRight: '10px'}}
                        >
                          {shell.nodename}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            this.props.removeShell(shell.nodename)
                          }}
                          className={`button button-default react-tabs__tab--remove icon remove`}
                        />
                      </Tab>
                    )
                  })}
                  <li
                    className={`react-tabs__tab`}
                    onClick={() => this.onAddTabClick()}
                  >
                    <span className={`icon plus`} />
                  </li>
                </TabList>
                {shells.map(shell => (
                  <TabPanel key={shell.tabkey}>
                    <ApolloProvider client={this.client}>
                      <Shell
                        isExistInLinks={this.isExistInLinks(
                          AddonType.router128T
                        )}
                        isNewEditor={shell.isNewEditor}
                        handleShellUpdate={this.props.updateShell}
                        handleShellRemove={this.props.removeShell}
                        onTabNameRefresh={this.onTabNameRefresh}
                        shells={shells}
                        nodename={shell.nodename}
                        addr={shell.addr}
                        tabkey={shell.tabkey}
                        notify={notify}
                      />
                    </ApolloProvider>
                  </TabPanel>
                ))}
              </Tabs>
            </div>
          </div>
        </Rnd>
      </div>
    )
  }
}

const mapStateToProps = ({
  shell: {isVisible, tabIndex, shells},
  sources,
  links,
}) => ({
  isVisible,
  shells,
  tabIndex,
  sources,
  links,
})

const mapDispatchToProps = {
  addShell: addShell,
  closeShell: closeShell,
  removeShell: removeShell,
  updateShell: updateShell,
  indexShell: indexShell,
  notify: notifyAction,
}

export default connect(mapStateToProps, mapDispatchToProps)(ShellModaless)
