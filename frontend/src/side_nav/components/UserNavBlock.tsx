// Libraries
import React, {CSSProperties, PureComponent} from 'react'
import {createPortal} from 'react-dom'
import {connect} from 'react-redux'
import {Link} from 'react-router'
import {withTranslation, WithTranslation} from 'react-i18next'
import classnames from 'classnames'

// Components
import OrgLink from 'src/side_nav/components/OrgLink'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'

// Actions
import {meChangeOrganizationAsync} from 'src/shared/actions/auth'
import {setLanguage} from 'src/shared/actions/app'

// Constants
import {SUPERADMIN_ROLE} from 'src/auth/Authorized'

// Types
import {Me, Links} from 'src/types/auth'
import {AppLanguage} from 'src/shared/utils/language'
import {
  computeSidebarMenuStyle,
  isSidebarMenuOpeningUpward,
} from 'src/side_nav/utils/sidebarMenuPosition'

import {ErrorHandling} from 'src/shared/decorators/errors'

interface OrgID {
  organization: string
}

interface Props extends WithTranslation {
  me: Me
  links: Links
  logoutLink: string
  meChangeOrg: (meLink: string, orgID: OrgID) => void
  sourcePrefix: string
  setLanguage: typeof setLanguage
}

interface State {
  isMenuOpen: boolean
  menuStyle: CSSProperties
  opensUpward: boolean
}

@ErrorHandling
class UserNavBlock extends PureComponent<Props, State> {
  private itemRef: HTMLDivElement = null
  private menuRef: HTMLDivElement = null
  private scrollParent: Element = null

  public state: State = {
    isMenuOpen: false,
    menuStyle: {},
    opensUpward: false,
  }

  public componentWillUnmount() {
    this.unbindScrollListener()
  }

  public render() {
    const {logoutLink, me, links, meChangeOrg, sourcePrefix, i18n} = this.props
    const {isMenuOpen, menuStyle, opensUpward} = this.state

    return (
      <div
        ref={this.setItemRef}
        className={classnames('sidebar--item', {
          'sidebar--item__menu-open': isMenuOpen,
        })}
        onMouseEnter={this.handleOpenMenu}
        onMouseLeave={this.handleItemMouseLeave}
      >
        <div className="sidebar--square">
          <div className="sidebar--icon icon user-outline" />
          {this.isSuperAdmin && (
            <span className="sidebar--icon sidebar--icon__superadmin icon crown2" />
          )}
        </div>
        {isMenuOpen &&
          createPortal(
            <div
              ref={this.setMenuRef}
              className={classnames('sidebar-menu sidebar-menu--user-nav', {
                'sidebar-menu--opens-up': opensUpward,
              })}
              style={menuStyle}
              onMouseLeave={this.handleMenuMouseLeave}
            >
              <div className="sidebar-menu--section sidebar-menu--section__switch-orgs">
                Switch Organizations
              </div>
              <FancyScrollbar
                className="sidebar-menu--scrollbar"
                autoHeight={true}
                maxHeight={100}
                autoHide={false}
              >
                {me.roles.map((r, i) => (
                  <OrgLink
                    onMeChangeOrg={meChangeOrg}
                    meLink={links.me}
                    key={i}
                    me={me}
                    role={r}
                  />
                ))}
              </FancyScrollbar>
              <div className="sidebar-menu--section sidebar-menu--section__account">
                Account
              </div>
              <div className="sidebar-menu--provider">
                <div>
                  {me.scheme} / {me.provider}
                </div>
              </div>

              {me.provider === 'cloudhub' && (
                <Link
                  className="sidebar-menu--item sidebar-menu--item__account-change"
                  to={`${sourcePrefix}/account-change`}
                >
                  Edit Account
                </Link>
              )}
              <a
                className="sidebar-menu--item sidebar-menu--item__logout"
                href={logoutLink}
              >
                Log out
              </a>
              <div className="sidebar-menu--section sidebar-menu--section__language">
                Language
              </div>
              <div className="sidebar-menu--language-toggle-wrapper">
                <div className="sidebar-menu--language-toggle">
                  <div
                    className={`language-toggle--item ${
                      !i18n.language.startsWith('ko') ? 'active' : ''
                    }`}
                    onClick={() => this.handleSetLanguage('en')}
                  >
                    EN
                  </div>
                  <div
                    className={`language-toggle--item ${
                      i18n.language.startsWith('ko') ? 'active' : ''
                    }`}
                    onClick={() => this.handleSetLanguage('ko')}
                  >
                    KO
                  </div>
                </div>
              </div>
              <div className="sidebar-menu--heading sidebar--no-hover">
                {me.name}
              </div>
            </div>,
            document.body
          )}
      </div>
    )
  }

  private setItemRef = (el: HTMLDivElement) => {
    this.itemRef = el
  }

  private setMenuRef = (el: HTMLDivElement) => {
    this.menuRef = el
    if (el) {
      requestAnimationFrame(() => this.updateMenuPosition())
    }
  }

  private isNodeInside = (node: EventTarget, container: HTMLElement) => {
    return (
      !!container &&
      node instanceof Node &&
      container.contains(node)
    )
  }

  private updateMenuPosition = () => {
    if (!this.itemRef) {
      return
    }

    const itemRect = this.itemRef.getBoundingClientRect()
    const menuHeight = this.menuRef?.offsetHeight ?? 0
    const opensUpward = isSidebarMenuOpeningUpward(itemRect, menuHeight)

    this.setState({
      menuStyle: computeSidebarMenuStyle(itemRect, menuHeight),
      opensUpward,
    })
  }

  private bindScrollListener = () => {
    if (!this.itemRef || this.scrollParent) {
      return
    }

    const scrollParent = this.itemRef.closest('.sidebar--scroll')
    if (scrollParent) {
      this.scrollParent = scrollParent
      this.scrollParent.addEventListener('scroll', this.updateMenuPosition)
    }
  }

  private unbindScrollListener = () => {
    if (this.scrollParent) {
      this.scrollParent.removeEventListener('scroll', this.updateMenuPosition)
      this.scrollParent = null
    }
  }

  private closeMenu = () => {
    this.unbindScrollListener()
    this.setState({isMenuOpen: false, opensUpward: false})
  }

  private handleOpenMenu = () => {
    if (!this.itemRef) {
      return
    }

    const itemRect = this.itemRef.getBoundingClientRect()
    this.bindScrollListener()
    this.setState({
      isMenuOpen: true,
      menuStyle: computeSidebarMenuStyle(itemRect, 0),
      opensUpward: false,
    })
  }

  private handleItemMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.isNodeInside(event.relatedTarget, this.menuRef)) {
      return
    }
    this.closeMenu()
  }

  private handleMenuMouseLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.isNodeInside(event.relatedTarget, this.itemRef)) {
      return
    }
    this.closeMenu()
  }

  private handleSetLanguage = (language: AppLanguage) => {
    this.props.setLanguage(language)
    this.props.i18n.changeLanguage(language)
  }

  private get isSuperAdmin(): boolean {
    return this.props.me.role === SUPERADMIN_ROLE
  }
}

const mdtp = {
  meChangeOrg: meChangeOrganizationAsync,
  setLanguage,
}

export default withTranslation()(connect(null, mdtp)(UserNavBlock))
