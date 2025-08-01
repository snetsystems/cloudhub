import React, {FunctionComponent, ChangeEvent, KeyboardEvent} from 'react'
import {CSSProperties} from 'react'

const disabledClass = (disabled: boolean) => (disabled ? ' disabled' : '')

type OnFilterChangeHandler = (e: ChangeEvent<HTMLInputElement>) => void
type OnFilterKeyPress = (e: KeyboardEvent<HTMLInputElement>) => void

interface Props {
  searchTerm: string
  buttonSize: string
  buttonColor: string
  toggleStyle?: CSSProperties
  disabled?: boolean
  onFilterChange: OnFilterChangeHandler
  onFilterKeyPress: OnFilterKeyPress
  placeholder?: string
  value?: string
  autoFocus?: boolean
}

const DropdownInput: FunctionComponent<Props> = ({
  searchTerm,
  buttonSize,
  buttonColor,
  toggleStyle,
  disabled,
  onFilterChange,
  onFilterKeyPress,
  placeholder,
  value,
  autoFocus,
}) => (
  <div
    className={`dropdown-autocomplete dropdown-toggle ${buttonSize} ${buttonColor}${disabledClass(
      disabled
    )}`}
    style={toggleStyle}
  >
    <input
      className="dropdown-autocomplete--input"
      type="text"
      autoFocus={autoFocus ?? true}
      placeholder={`${placeholder ?? 'Filter items...'}`}
      spellCheck={false}
      onChange={onFilterChange}
      onKeyDown={onFilterKeyPress}
      value={value ?? searchTerm}
      disabled={disabled}
    />
    <span className="caret" />
  </div>
)

export default DropdownInput
