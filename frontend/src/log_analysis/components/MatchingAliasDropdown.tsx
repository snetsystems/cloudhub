// Library
import React, {
  PureComponent,
  MouseEvent,
  ChangeEvent,
  KeyboardEvent,
  RefObject,
} from 'react'
import _ from 'lodash'
import classnames from 'classnames'

// Components
import OnClickOutside from 'src/shared/components/OnClickOutside'
import DropdownMenu, {
  DropdownMenuEmpty,
} from 'src/shared/components/DropdownMenu'
import LoadingSpinner from 'src/flux/components/LoadingSpinner'
import DropdownInputWithRef from 'src/shared/components/DropdownInputWithRef'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Types
import {DropdownItem, DropdownAction} from 'src/types'
import {ComponentStatus} from 'src/reusable_ui'

interface AddNew {
  url?: string
  text: string
  handler?: () => void
}

interface Props {
  items: DropdownItem[]
  onChoose: (item: DropdownItem) => void
  selected: string
  addNew?: AddNew
  actions?: DropdownAction[]
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  iconName?: string
  className?: string
  buttonSize?: string
  buttonColor?: string
  menuWidth?: string
  menuLabel?: string
  menuClass?: string
  useAutoComplete?: boolean
  toggleStyle?: object
  disabled?: boolean
  tabIndex?: number
  isOpen: boolean
  onClose: () => void
  status?: ComponentStatus
  placeholder?: string
  serverStoredAliasName?: string
  inputRef?: RefObject<HTMLInputElement>
}

interface State {
  searchTerm: string
  filteredItems: DropdownItem[]
  highlightedItemIndex: number
}

@ErrorHandling
export class MatchingAliasDropdown extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    actions: [],
    buttonSize: 'btn-sm',
    buttonColor: 'btn-default',
    menuWidth: '100%',
    useAutoComplete: false,
    disabled: false,
    tabIndex: 0,
  }
  public dropdownRef: any

  constructor(props: Props) {
    super(props)
    this.state = {
      searchTerm: '',
      filteredItems: this.props.items,
      highlightedItemIndex: null,
    }
  }

  public componentDidMount() {
    const {selected} = this.props
    this.setState({searchTerm: selected}, () => {
      this.applyFilter(selected)
    })
  }

  public componentDidUpdate(prevProps: Props) {
    if (!_.isEqual(prevProps.items, this.props.items)) {
      this.setState({filteredItems: this.props.items}, () => {
        this.applyFilter(this.state.searchTerm)
      })
      return
    }

    if (prevProps.selected !== this.props.selected) {
      this.setState({searchTerm: this.props.selected}, () => {
        this.applyFilter(this.props.selected)
      })
    }
  }

  public handleClickOutside = () => {
    this.setState({searchTerm: this.props.selected})
    this.props.onClose()
  }

  public handleSelection = (item: DropdownItem) => (
    e: MouseEvent<HTMLAnchorElement>
  ) => {
    e.stopPropagation()

    this.props.onChoose(item)
    this.setState({searchTerm: item.text})

    this.dropdownRef.focus()
  }

  public handleHighlight = (itemIndex: number) => () => {
    this.setState({highlightedItemIndex: itemIndex})
  }

  public toggleMenu = (e?: MouseEvent<HTMLDivElement>) => {
    if (e) {
      e.stopPropagation()
    }

    if (!this.props.isOpen) {
      this.setState({
        searchTerm: '',
        filteredItems: this.props.items,
        highlightedItemIndex: null,
      })
    }
  }

  public handleAction = (action: DropdownAction, item: DropdownItem) => (
    e: MouseEvent<HTMLDivElement>
  ) => {
    e.stopPropagation()
    action.handler(item)
  }

  public handleFilterKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    const {filteredItems, highlightedItemIndex} = this.state

    if (e.key === 'Enter' && filteredItems.length) {
      const selectedItem = filteredItems[highlightedItemIndex]
      if (selectedItem) {
        this.props.onClose()
        this.props.onChoose(selectedItem)
        this.setState({searchTerm: selectedItem.text})
      }
    }
    if (e.key === 'Escape') {
      this.setState({searchTerm: this.props.selected})
      this.props.onClose()
    }
    if (e.key === 'ArrowUp' && highlightedItemIndex > 0) {
      this.setState({highlightedItemIndex: highlightedItemIndex - 1})
    }
    if (e.key === 'ArrowDown') {
      if (highlightedItemIndex < filteredItems.length - 1) {
        this.setState({highlightedItemIndex: highlightedItemIndex + 1})
      }
      if (highlightedItemIndex === null && filteredItems.length) {
        this.setState({highlightedItemIndex: 0})
      }
    }
  }

  public handleFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    return this.setState({searchTerm: value}, () => {
      this.applyFilter(this.state.searchTerm)
    })
  }

  public applyFilter = (searchTerm: string) => {
    const {items} = this.props
    const filterText = searchTerm.toLowerCase()
    const matchingItems = items.filter(item => {
      if (!item) {
        return false
      }

      return item.text.toLowerCase().includes(filterText)
    })

    const newHighlightedIndex = matchingItems.length > 0 ? 0 : null

    this.setState({
      filteredItems: matchingItems,
      highlightedItemIndex: newHighlightedIndex,
    })
  }

  public render() {
    const {
      isOpen,
      items,
      addNew,
      actions,
      disabled,
      tabIndex,
      className,
      menuClass,
      menuWidth,
      menuLabel,
      buttonSize,
      buttonColor,
      toggleStyle,
      useAutoComplete,
      status,
      selected,
      placeholder,
      serverStoredAliasName,
      inputRef,
    } = this.props

    const {searchTerm, filteredItems, highlightedItemIndex} = this.state

    const menuItems = useAutoComplete ? filteredItems : items
    return (
      <div
        onClick={this.handleClick}
        className={classnames('dropdown', {
          open: isOpen,
          [className]: className,
        })}
        tabIndex={tabIndex}
        ref={r => (this.dropdownRef = r)}
        data-test="dropdown-toggle"
      >
        {status === ComponentStatus.Loading ? (
          <div className="dropdown-loading">
            <LoadingSpinner />
          </div>
        ) : null}

        <DropdownInputWithRef
          searchTerm={searchTerm}
          buttonSize={buttonSize}
          buttonColor={buttonColor}
          toggleStyle={toggleStyle}
          disabled={disabled || status === ComponentStatus.Loading}
          onFilterChange={this.handleFilterChange}
          onFilterKeyPress={this.handleFilterKeyPress}
          placeholder={placeholder}
          value={searchTerm}
          ref={inputRef}
        />

        {isOpen && menuItems && menuItems.length ? (
          <DropdownMenu
            addNew={addNew}
            actions={actions}
            items={menuItems}
            selected={selected}
            menuClass={menuClass}
            menuWidth={menuWidth}
            menuLabel={menuLabel}
            onAction={this.handleAction}
            useAutoComplete={useAutoComplete}
            onSelection={this.handleSelection}
            onHighlight={this.handleHighlight}
            highlightedItemIndex={highlightedItemIndex}
          />
        ) : (
          <DropdownMenuEmpty
            useAutoComplete={useAutoComplete}
            menuClass={menuClass}
            emptyMessage={
              searchTerm === serverStoredAliasName
                ? serverStoredAliasName
                : undefined
            }
          />
        )}
      </div>
    )
  }

  private handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const {disabled, onClick} = this.props

    if (disabled) {
      return
    }

    if (!this.props.isOpen) {
      this.setState(
        {
          highlightedItemIndex: null,
        },
        () => {
          this.applyFilter(this.state.searchTerm)
        }
      )
    } else {
      this.setState({searchTerm: this.props.selected})
    }

    if (onClick) {
      onClick(e)
    }
  }
}

export default OnClickOutside(MatchingAliasDropdown)
