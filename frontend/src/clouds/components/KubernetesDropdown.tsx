// library
import React, {
  PureComponent,
  MouseEvent,
  ChangeEvent,
  KeyboardEvent,
} from 'react'
import _ from 'lodash'
import classnames from 'classnames'

// components
import OnClickOutside from 'src/shared/components/OnClickOutside'
import DropdownMenu, {
  DropdownMenuEmpty,
} from 'src/shared/components/DropdownMenu'
import DropdownInput from 'src/shared/components/DropdownInput'
import DropdownHead from 'src/shared/components/DropdownHead'
import LoadingSpinner from 'src/flux/components/LoadingSpinner'
import {ErrorHandling} from 'src/shared/decorators/errors'
// types
import {DropdownItem, DropdownAction} from 'src/types'
import {ComponentStatus} from 'src/reusable_ui'

//constants
import {COLLECTOR_SERVER} from 'src/shared/constants'

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
  onClose: () => void
  status?: ComponentStatus
}

interface State {
  searchTerm: string
  filteredItems: DropdownItem[]
  highlightedItemIndex: number
}

@ErrorHandling
export class KubernetesDropdown extends PureComponent<Props, State> {
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

  public handleClickOutside = () => {
    this.props.onClose()
  }

  public handleSelection = (item: DropdownItem) => () => {
    this.toggleMenu()
    this.props.onChoose(item)
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
      this.props.onClose()
      this.props.onChoose(filteredItems[highlightedItemIndex])
    }
    if (e.key === 'Escape') {
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
    if (e.target.value) {
      return this.setState({searchTerm: e.target.value}, () =>
        this.applyFilter(this.state.searchTerm)
      )
    }

    this.setState({
      searchTerm: '',
      filteredItems: this.props.items,
      highlightedItemIndex: null,
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

    this.setState({
      filteredItems: matchingItems,
      highlightedItemIndex: 0,
    })
  }

  public render() {
    const {
      isOpen,
      items,
      addNew,
      actions,
      selected,
      disabled,
      iconName,
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
    } = this.props

    const {searchTerm, filteredItems, highlightedItemIndex} = this.state

    const minions = useAutoComplete ? filteredItems : items
    const menuItems = _.filter(minions, (item: string) =>
      _.startsWith(item, COLLECTOR_SERVER)
    ) as DropdownItem[]

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
        {useAutoComplete && this.props.isOpen ? (
          <DropdownInput
            searchTerm={searchTerm}
            buttonSize={buttonSize}
            buttonColor={buttonColor}
            toggleStyle={toggleStyle}
            disabled={disabled || status === ComponentStatus.Loading}
            onFilterChange={this.handleFilterChange}
            onFilterKeyPress={this.handleFilterKeyPress}
          />
        ) : (
          <DropdownHead
            iconName={iconName}
            selected={selected}
            buttonSize={buttonSize}
            buttonColor={buttonColor}
            toggleStyle={toggleStyle}
            disabled={disabled}
          />
        )}
        {isOpen && menuItems.length ? (
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

    this.toggleMenu(e)
    if (onClick) {
      onClick(e)
    }
  }
}

export default OnClickOutside(KubernetesDropdown)
