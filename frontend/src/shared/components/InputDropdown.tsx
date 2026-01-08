import React, {
  PureComponent,
  MouseEvent,
  ChangeEvent,
  KeyboardEvent,
} from 'react'
import classnames from 'classnames'
import OnClickOutside from 'src/shared/components/OnClickOutside'
import DropdownMenu, {
  DropdownMenuEmpty,
} from 'src/shared/components/DropdownMenu'
import DropdownInput from 'src/shared/components/DropdownInput'
import LoadingSpinner from 'src/flux/components/LoadingSpinner'

import {ErrorHandling} from 'src/shared/decorators/errors'

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
  onChange?: (item: any) => any
  onClose: (value: string) => void
  status?: ComponentStatus
  placeholder?: string
  autofocus?: boolean
}

interface State {
  searchTerm: string
  filteredItems: DropdownItem[]
  highlightedItemIndex: number
  isSelecting: boolean
}

@ErrorHandling
export class InputDropdown extends PureComponent<Props, State> {
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
      isSelecting: false,
    }
  }

  public componentDidMount() {
    const {selected} = this.props
    this.setState({searchTerm: selected})
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.selected !== this.props.selected) {
      this.setState({searchTerm: this.props.selected})
    }
  }

  public handleClickOutside = async () => {
    const {searchTerm} = this.state

    this.props.onClose(searchTerm)
  }

  public handleSelection = (item: DropdownItem) => (
    e: MouseEvent<HTMLAnchorElement>
  ) => {
    e.stopPropagation()
    const {onClose} = this.props

    // this.props.onChoose(item)
    this.setState({searchTerm: item.text})
    onClose(item.text)

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

    const {onClose} = this.props
    onClose(item.text)
  }

  public handleFilterKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    const {filteredItems, highlightedItemIndex} = this.state
    if (e.key === 'Enter') {
      if (filteredItems.length > 0) {
        this.setState({searchTerm: filteredItems[highlightedItemIndex].text})
        this.props.onClose(filteredItems[highlightedItemIndex].text)
      } else {
        this.props.onClose(this.state.searchTerm)
      }
      this.dropdownRef.focus()
    }
    if (e.key === 'Escape') {
      this.props.onClose(this.state.searchTerm)
      this.dropdownRef.focus()
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

    // this.setState({
    //   searchTerm: '',
    //   filteredItems: this.props.items,
    //   highlightedItemIndex: null,
    // })
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

    this.setState({
      filteredItems: matchingItems,
      highlightedItemIndex: 0,
    })
  }

  public getEmptyMessage = () => {
    const {searchTerm} = this.state
    const {selected} = this.props

    if (!searchTerm || searchTerm.trim() === '') {
      return 'Please enter an alias'
    }

    if (selected === searchTerm) {
      return selected
    }
    return `New alias : ${searchTerm}`
  }

  public handleEmptySelection = (e: MouseEvent<HTMLLIElement>) => {
    e.stopPropagation()

    this.props.onClose(this.state.searchTerm)
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
      placeholder,
      autofocus,
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

        <DropdownInput
          searchTerm={searchTerm}
          buttonSize={buttonSize}
          buttonColor={buttonColor}
          toggleStyle={toggleStyle}
          disabled={disabled || status === ComponentStatus.Loading}
          onFilterChange={this.handleFilterChange}
          onFilterKeyPress={this.handleFilterKeyPress}
          placeholder={placeholder}
          value={searchTerm}
          autoFocus={autofocus}
        />

        {isOpen && menuItems.length ? (
          <DropdownMenu
            addNew={addNew}
            actions={actions}
            items={menuItems}
            selected={searchTerm}
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
            emptyMessage={this.getEmptyMessage()}
            onClick={this.handleEmptySelection}
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
          // searchTerm: '',
          highlightedItemIndex: null,
        },
        () => {
          this.applyFilter(this.state.searchTerm)
        }
      )
    }

    if (onClick) {
      onClick(e)
    }
  }
}

export default OnClickOutside(InputDropdown)
