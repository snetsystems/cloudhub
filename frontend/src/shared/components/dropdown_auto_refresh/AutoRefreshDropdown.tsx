// Libraries
import React, {Component} from 'react'
import classnames from 'classnames'
import _ from 'lodash'

// Components
import {Dropdown, Button, ButtonShape, IconFont} from 'src/reusable_ui'

// Constants
import {
  getAutoRefreshOptions,
  AutoRefreshOption,
  AutoRefreshOptionType,
} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

import {ErrorHandling} from 'src/shared/decorators/errors'

// Types
import {CloudAutoRefresh} from 'src/clouds/types/type'

interface Props {
  selected: number
  onChoose: (autoRefreshOption: AutoRefreshOption) => void
  showManualRefresh?: boolean
  onManualRefresh?: () => void
  userAutoRefreshOptions?: AutoRefreshOption[]
  customAutoRefreshOptions?: AutoRefreshOption[]
  customAutoRefreshSelected?: CloudAutoRefresh
}
interface State {
  isOpen: boolean
}
@ErrorHandling
class AutoRefreshDropdown extends Component<Props, State> {
  public static defaultProps: Partial<Props> = {
    showManualRefresh: true,
  }

  constructor(props) {
    super(props)

    this.state = {
      isOpen: false,
    }
  }

  public render() {
    return (
      <div className={this.className}>
        <Dropdown
          icon={this.dropdownIcon}
          widthPixels={this.dropdownWidthPixels}
          onChange={this.handleDropdownChange}
          selectedID={this.selectedID}
        >
          {this.autoRefreshDropdownItems}
        </Dropdown>
        {this.manualRefreshButton}
      </div>
    )
  }

  public handleDropdownChange = (
    autoRefreshOption: AutoRefreshOption
  ): void => {
    const {onChoose} = this.props
    onChoose(autoRefreshOption)
  }

  private get isPaused(): boolean {
    const {
      selected,
      customAutoRefreshOptions,
      customAutoRefreshSelected,
    } = this.props

    if (customAutoRefreshOptions) {
      const groupName = customAutoRefreshOptions[0].group
      const customRefreshTime =
        customAutoRefreshSelected?.[groupName] === undefined
          ? 0
          : customAutoRefreshSelected?.[groupName]

      return customRefreshTime === 0
    }

    return selected === 0
  }

  private get className(): string {
    return classnames('autorefresh-dropdown', {paused: this.isPaused})
  }

  private get dropdownIcon(): IconFont {
    if (this.isPaused) {
      return IconFont.Pause
    }

    return IconFont.Refresh
  }

  private get dropdownWidthPixels(): number {
    if (this.isPaused) {
      return 50
    }

    return 84
  }

  private get selectedID(): string {
    const {
      selected,
      customAutoRefreshOptions,
      customAutoRefreshSelected,
    } = this.props

    if (customAutoRefreshOptions) {
      const autoRefreshOptions = this.getCombinedAutoRefreshOptions()

      const selectedOption = _.find(
        autoRefreshOptions,
        option =>
          option.milliseconds ===
          (customAutoRefreshSelected?.[option.group] ||
            customAutoRefreshSelected?.default)
      )
      return selectedOption?.id || 'auto-refresh-paused'
    }

    const autoRefreshOptions = getAutoRefreshOptions()
    const selectedOption = _.find(
      autoRefreshOptions,
      option => option.milliseconds === selected
    )
    return selectedOption.id
  }

  private get manualRefreshButton(): JSX.Element {
    const {showManualRefresh, onManualRefresh} = this.props

    if (!showManualRefresh) {
      return
    }

    if (this.isPaused) {
      return (
        <Button
          shape={ButtonShape.Square}
          icon={IconFont.Refresh}
          onClick={onManualRefresh}
        />
      )
    }

    return null
  }
  private getCombinedAutoRefreshOptions() {
    const {customAutoRefreshOptions} = this.props

    return customAutoRefreshOptions || getAutoRefreshOptions()
  }

  private get autoRefreshDropdownItems(): JSX.Element[] {
    const autoRefreshDropdownItems = this.getCombinedAutoRefreshOptions()
    return autoRefreshDropdownItems.map(option => {
      if (option.type === AutoRefreshOptionType.Header) {
        return (
          <Dropdown.Divider
            key={option.id}
            id={option.id}
            text={option.label}
          />
        )
      }

      return (
        <Dropdown.Item key={option.id} id={option.id} value={option}>
          {option.label}
        </Dropdown.Item>
      )
    })
  }
}

export default AutoRefreshDropdown
