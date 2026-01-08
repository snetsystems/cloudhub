// Libraries
import React, {
  Component,
  CSSProperties,
  Fragment,
  ChangeEvent,
  KeyboardEvent,
} from 'react'
import classnames from 'classnames'
import _ from 'lodash'

// Components
import {ClickOutside} from 'src/shared/components/ClickOutside'
import DropdownDivider from 'src/reusable_ui/components/dropdowns/DropdownDivider'
import DropdownItem from 'src/reusable_ui/components/dropdowns/DropdownItem'
import DropdownButton from 'src/reusable_ui/components/dropdowns/DropdownButton'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import DropdownInput from 'src/shared/components/DropdownInput'
import {DropdownMenuEmpty} from 'src/shared/components/DropdownMenu'

// Types
import {
  DropdownMenuColors,
  ComponentStatus,
  ComponentColor,
  ComponentSize,
  IconFont,
} from 'src/reusable_ui/types'
import {DropdownItem as DropdownItemType} from 'src/types'
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  items: DropdownItemType[]
  selectedIDs: string[]
  onChange: (selectedIDs: string[], value: any) => void
  onCollapse?: () => void
  buttonColor?: ComponentColor
  buttonSize?: ComponentSize
  menuColor?: DropdownMenuColors
  status?: ComponentStatus
  widthPixels?: number
  icon?: IconFont
  wrapText?: boolean
  customClass?: string
  maxMenuHeight?: number
  emptyText?: string
  separatorText?: string
  maxSelections?: number
  exemptFromLimit?: string[]
  useAutoComplete?: boolean
}

interface State {
  expanded: boolean
  searchTerm: string
  filteredChildren: JSX.Element[]
  highlightedItemIndex: number | null
}

@ErrorHandling
class MultiSelectAutoCompleteDropdown extends Component<Props, State> {
  public static defaultProps: Partial<Props> = {
    buttonColor: ComponentColor.Default,
    buttonSize: ComponentSize.Small,
    status: ComponentStatus.Default,
    wrapText: false,
    maxMenuHeight: 250,
    menuColor: DropdownMenuColors.Sapphire,
    emptyText: 'Choose an item',
    separatorText: ', ',
    maxSelections: undefined,
    exemptFromLimit: [],
    useAutoComplete: false,
  }

  public static Button = DropdownButton
  public static Item = DropdownItem
  public static Divider = DropdownDivider

  private searchInputRef: HTMLInputElement | null = null

  constructor(props: Props) {
    super(props)

    this.state = {
      expanded: false,
      searchTerm: '',
      filteredChildren: this.getChildrenFromProps(props),
      highlightedItemIndex: null,
    }
  }

  public componentDidUpdate(prevProps: Props) {
    if (!_.isEqual(prevProps.items, this.props.items)) {
      this.setState({
        filteredChildren: this.getChildrenFromProps(this.props),
        searchTerm: '',
        highlightedItemIndex: null,
      })
    }
  }

  private getChildrenFromProps = (props: Props): JSX.Element[] => {
    if (props.items && props.items.length > 0) {
      return props.items.map(item => (
        <DropdownItem key={item.text} id={item.text} value={{id: item.text}}>
          {item.text}
        </DropdownItem>
      ))
    }
    return []
  }

  public render() {
    return (
      <ClickOutside onClickOutside={this.collapseMenu}>
        <div
          className={classnames(this.containerClassName, {
            open: this.state.expanded,
          })}
          style={this.containerStyle}
        >
          {this.button}
          {this.menuItems}
        </div>
      </ClickOutside>
    )
  }

  private toggleMenu = (): void => {
    const {useAutoComplete} = this.props
    const {expanded} = this.state

    if (!expanded && useAutoComplete) {
      this.setState(
        {
          expanded: !expanded,
          searchTerm: '',
          filteredChildren: this.getChildrenFromProps(this.props),
          highlightedItemIndex: null,
        },
        () => {
          if (this.searchInputRef) {
            this.searchInputRef.focus()
          }
        }
      )
    } else {
      this.setState({expanded: !expanded})
    }
  }

  private collapseMenu = (): void => {
    const {onCollapse} = this.props

    this.setState({
      expanded: false,
      searchTerm: '',
      filteredChildren: this.getChildrenFromProps(this.props),
      highlightedItemIndex: null,
    })

    if (onCollapse) {
      onCollapse()
    }
  }

  private handleFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value

    this.setState({searchTerm}, () => {
      if (searchTerm.trim()) {
        this.applyFilter(searchTerm)
      } else {
        this.setState({
          filteredChildren: this.getChildrenFromProps(this.props),
          highlightedItemIndex: null,
        })
      }
    })
  }

  private handleFilterKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    const {filteredChildren, highlightedItemIndex} = this.state

    if (
      e.key === 'Enter' &&
      filteredChildren.length &&
      highlightedItemIndex !== null
    ) {
      const highlightedItem = this.getDropdownItemAtIndex(highlightedItemIndex)
      if (highlightedItem) {
        this.handleItemClick({id: highlightedItem.props.id})
      }
    }

    if (e.key === 'Escape') {
      this.collapseMenu()
    }

    if (
      e.key === 'ArrowUp' &&
      highlightedItemIndex !== null &&
      highlightedItemIndex > 0
    ) {
      this.setState({highlightedItemIndex: highlightedItemIndex - 1})
    }

    if (e.key === 'ArrowDown') {
      const dropdownItemsCount = this.getDropdownItemsCount()
      if (highlightedItemIndex === null && dropdownItemsCount > 0) {
        this.setState({highlightedItemIndex: 0})
      } else if (
        highlightedItemIndex !== null &&
        highlightedItemIndex < dropdownItemsCount - 1
      ) {
        this.setState({highlightedItemIndex: highlightedItemIndex + 1})
      }
    }
  }

  private getDropdownItemsCount = (): number => {
    return this.state.filteredChildren.filter(
      child => child.type === DropdownItem
    ).length
  }

  private getDropdownItemAtIndex = (index: number): JSX.Element | null => {
    const dropdownItems = this.state.filteredChildren.filter(
      child => child.type === DropdownItem
    )
    return dropdownItems[index] || null
  }

  private applyFilter = (searchTerm: string) => {
    const children = this.getChildrenFromProps(this.props)
    const filterText = searchTerm.toLowerCase()

    const filteredChildren = children.filter(child => {
      if (child.type === DropdownDivider) {
        return true
      }

      if (child.type === DropdownItem) {
        const text =
          typeof child.props.children === 'string'
            ? child.props.children
            : child.props.text || ''
        return text.toLowerCase().includes(filterText)
      }

      return false
    })

    this.setState({
      filteredChildren,
      highlightedItemIndex:
        filteredChildren.findIndex(child => child.type === DropdownItem) >= 0
          ? 0
          : null,
    })
  }

  private get containerStyle(): CSSProperties {
    const {widthPixels} = this.props

    if (widthPixels) {
      return {width: `${widthPixels}px`}
    }

    return {width: '100%'}
  }

  private get containerClassName(): string {
    const {buttonColor, buttonSize, status, wrapText, customClass} = this.props

    return classnames(
      `dropdown dropdown-${buttonSize} dropdown-${buttonColor}`,
      {
        disabled: status === ComponentStatus.Disabled,
        'dropdown-wrap': wrapText,
        [customClass]: customClass,
      }
    )
  }

  private get button(): JSX.Element {
    const {
      selectedIDs,
      status,
      buttonColor,
      buttonSize,
      icon,
      emptyText,
      separatorText,
      useAutoComplete,
    } = this.props
    const {expanded, searchTerm} = this.state

    const children = this.getChildrenFromProps(this.props)
    const selectedChildren = children.filter(child =>
      _.includes(selectedIDs, child.props.id)
    )

    if (status === ComponentStatus.Loading) {
      return <div className="dropdown--loading" />
    } else if (useAutoComplete && expanded) {
      return (
        <DropdownInput
          searchTerm={searchTerm}
          buttonSize={`btn-${buttonSize}`}
          buttonColor={`btn-${buttonColor}`}
          onFilterChange={this.handleFilterChange}
          onFilterKeyPress={this.handleFilterKeyPress}
          toggleStyle={{
            width: '100%',
            height: '30px',
          }}
          autoFocus={true}
          onClick={this.toggleMenu}
        />
      )
    } else if (selectedChildren.length) {
      const label = selectedChildren.map((sc, i) => {
        if (i < selectedChildren.length - 1) {
          return (
            <Fragment key={sc.props.id}>
              {sc.props.children}
              {separatorText}
            </Fragment>
          )
        }

        return sc.props.children
      })

      return (
        <DropdownButton
          active={expanded}
          color={buttonColor}
          size={buttonSize}
          icon={icon}
          onClick={this.toggleMenu}
          status={status}
          title={selectedChildren
            .map(sc => sc.props.children)
            .join(separatorText)}
        >
          {label}
        </DropdownButton>
      )
    } else {
      return (
        <DropdownButton
          active={expanded}
          color={buttonColor}
          size={buttonSize}
          icon={icon}
          onClick={this.toggleMenu}
          status={status}
        >
          {emptyText}
        </DropdownButton>
      )
    }
  }

  private get menuItems(): JSX.Element {
    const {
      selectedIDs,
      maxMenuHeight,
      menuColor,
      maxSelections,
      exemptFromLimit,
      useAutoComplete,
    } = this.props
    const {expanded, filteredChildren, highlightedItemIndex} = this.state

    if (expanded) {
      if (filteredChildren.length === 0) {
        return (
          <DropdownMenuEmpty useAutoComplete={useAutoComplete} menuClass="" />
        )
      }

      return (
        <div
          className={`dropdown--menu-container dropdown--${menuColor} dropdown--multiselect`}
          style={this.menuStyle}
        >
          <FancyScrollbar
            autoHide={false}
            autoHeight={true}
            maxHeight={maxMenuHeight}
          >
            <div className="dropdown--menu" data-test="dropdown-menu">
              {React.Children.map(
                filteredChildren,
                (child: JSX.Element, index) => {
                  if (this.childTypeIsValid(child)) {
                    if (child.type === DropdownItem) {
                      const isSelected = _.includes(selectedIDs, child.props.id)
                      const isExempt = _.includes(
                        exemptFromLimit,
                        child.props.id
                      )
                      const isDisabled =
                        maxSelections &&
                        selectedIDs.length >= maxSelections &&
                        !isSelected &&
                        !isExempt

                      const dropdownItemIndex = filteredChildren
                        .slice(0, index)
                        .filter(c => c.type === DropdownItem).length
                      const isHighlighted =
                        dropdownItemIndex === highlightedItemIndex

                      const dropdownItem = (
                        <div
                          key={child.props.id}
                          className={classnames(
                            'dropdown-item--multi-select--wrapper',
                            {
                              highlight: isHighlighted,
                            }
                          )}
                          onMouseEnter={() =>
                            this.handleMouseEnter(dropdownItemIndex)
                          }
                        >
                          <DropdownItem
                            {...child.props}
                            checkbox={true}
                            selected={isSelected}
                            onClick={
                              isDisabled ? undefined : this.handleItemClick
                            }
                          >
                            {child.props.children}
                          </DropdownItem>
                        </div>
                      )

                      if (isDisabled) {
                        return (
                          <div
                            key={`${child.props.id}-disabled`}
                            style={{
                              opacity: 0.5,
                              cursor: 'not-allowed',
                              pointerEvents: 'none',
                            }}
                          >
                            {dropdownItem}
                          </div>
                        )
                      }

                      return dropdownItem
                    }

                    return (
                      <DropdownDivider {...child.props} key={child.props.id} />
                    )
                  } else {
                    throw new Error(
                      'Expected children of type <Dropdown.Item /> or <Dropdown.Divider />'
                    )
                  }
                }
              )}
            </div>
          </FancyScrollbar>
        </div>
      )
    }

    return null
  }

  private get menuStyle(): CSSProperties {
    const {wrapText, widthPixels} = this.props

    let containerWidth = '100%'

    if (widthPixels) {
      containerWidth = `${widthPixels}px`
    }

    if (wrapText && widthPixels) {
      return {
        width: containerWidth,
      }
    }

    return {
      minWidth: containerWidth,
    }
  }

  private handleItemClick = (value: any): void => {
    const {onChange, selectedIDs, maxSelections, exemptFromLimit} = this.props
    let updatedSelection

    if (_.includes(selectedIDs, value.id)) {
      updatedSelection = selectedIDs.filter(id => id !== value.id)
    } else {
      const isExempt = _.includes(exemptFromLimit, value.id)
      if (maxSelections && selectedIDs.length >= maxSelections && !isExempt) {
        return
      }
      updatedSelection = [...selectedIDs, value.id]
    }

    onChange(updatedSelection, value)
  }

  private childTypeIsValid = (child: JSX.Element): boolean =>
    child.type === DropdownItem || child.type === DropdownDivider

  private handleMouseEnter = (dropdownItemIndex: number) => {
    if (this.state.highlightedItemIndex !== dropdownItemIndex) {
      this.setState({
        highlightedItemIndex: dropdownItemIndex,
      })
    }
  }
}

export default MultiSelectAutoCompleteDropdown
