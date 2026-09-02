import React, {
  PureComponent,
  FunctionComponent,
  ReactNode,
  ReactElement,
  CSSProperties,
} from 'react'
import {createPortal} from 'react-dom'
import {Link} from 'react-router'
import classnames from 'classnames'
import _ from 'lodash'

import {
  computeSidebarMenuStyle,
  isSidebarMenuOpeningUpward,
} from 'src/side_nav/utils/sidebarMenuPosition'

interface NavListItemProps {
  link: string
  location?: string
  useAnchor?: boolean
  isExternal?: boolean
  exact?: boolean
  icon?: string
  children?: ReactNode
}

const NavListItem: FunctionComponent<NavListItemProps> = ({
  link,
  children,
  location,
  useAnchor,
  isExternal,
  exact,
  icon,
}) => {
  const isActive = exact ? location === link : location.startsWith(link)
  const content = (
    <>
      {icon && (
        <span
          className={`icon ${icon} sidebar-menu--title-icon`}
          aria-hidden="true"
        />
      )}
      {children}
    </>
  )

  return useAnchor ? (
    <a
      className={classnames('sidebar-menu--item', {active: isActive})}
      href={link}
      target={isExternal ? '_blank' : '_self'}
    >
      {content}
    </a>
  ) : (
    <Link
      className={classnames('sidebar-menu--item', {active: isActive})}
      to={link}
    >
      {content}
    </Link>
  )
}

interface NavHeaderProps {
  link?: string
  title?: string
  useAnchor?: string
  icon?: string
}

const NavHeader: FunctionComponent<NavHeaderProps> = ({
  link,
  title,
  useAnchor,
  icon,
}) => {
  const content = (
    <>
      {icon && (
        <span
          className={`icon ${icon} sidebar-menu--title-icon`}
          aria-hidden="true"
        />
      )}
      {title}
    </>
  )

  // Some nav items, such as Logout, need to hit an external link rather
  // than simply route to an internal page. Anchor tags serve that purpose.
  return useAnchor ? (
    <a className="sidebar-menu--heading" href={link}>
      {content}
    </a>
  ) : (
    <Link className="sidebar-menu--heading" to={link}>
      {content}
    </Link>
  )
}

interface NavBlockProps {
  children?: ReactNode
  link?: string
  icon: string
  location?: string
  className?: string
  highlightWhen: string[]
  visible?: boolean
}

interface NavBlockState {
  isMenuOpen: boolean
  menuStyle: CSSProperties
  opensUpward: boolean
}

class NavBlock extends PureComponent<NavBlockProps, NavBlockState> {
  private itemRef: HTMLDivElement = null
  private menuRef: HTMLDivElement = null
  private scrollParent: Element = null

  public state: NavBlockState = {
    isMenuOpen: false,
    menuStyle: {},
    opensUpward: false,
  }

  public componentWillUnmount() {
    this.unbindScrollListener()
  }

  public render() {
    const {location, className, highlightWhen, visible = true} = this.props
    const {isMenuOpen, menuStyle, opensUpward} = this.state
    const {length} = _.intersection(_.split(location, '/'), highlightWhen)
    const isActive = !!length

    const children = React.Children.map(
      this.props.children,
      (child: ReactElement<any>) => {
        // FIXME
        if (child && String(child.type) === String(NavListItem)) {
          return React.cloneElement(child, {location})
        }

        return child
      }
    )

    return (
      <div
        ref={this.setItemRef}
        className={classnames('sidebar--item', className, {
          active: isActive,
          'sidebar--item__menu-open': isMenuOpen && visible,
          'sidebar--item__hidden': !visible,
        })}
        onMouseEnter={visible ? this.handleOpenMenu : undefined}
        onMouseLeave={visible ? this.handleItemMouseLeave : undefined}
      >
        {this.renderSquare()}
        {visible &&
          isMenuOpen &&
          createPortal(
            <div
              ref={this.setMenuRef}
              className={classnames('sidebar-menu', {
                'sidebar-menu--opens-up': opensUpward,
              })}
              style={menuStyle}
              onMouseLeave={this.handleMenuMouseLeave}
            >
              {children}
            </div>,
            document.body
          )}
      </div>
    )
  }

  private renderSquare() {
    const {link, icon} = this.props

    if (!link) {
      return (
        <div className="sidebar--square">
          <div className={`sidebar--icon icon ${icon}`} />
        </div>
      )
    }

    return (
      <Link className="sidebar--square" to={link}>
        <div className={`sidebar--icon icon ${icon}`} />
      </Link>
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
    return !!container && node instanceof Node && container.contains(node)
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
}

export {NavBlock, NavHeader, NavListItem}
