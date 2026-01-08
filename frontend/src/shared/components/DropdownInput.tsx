import React, {
  FunctionComponent,
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
} from 'react'
import {CSSProperties} from 'react'

const disabledClass = (disabled: boolean) => (disabled ? ' disabled' : '')

type OnFilterChangeHandler = (e: ChangeEvent<HTMLInputElement>) => void
type OnFilterKeyPress = (e: KeyboardEvent<HTMLInputElement>) => void
type OnClickHandler = (e: MouseEvent<HTMLDivElement>) => void

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
  readOnly?: boolean
  onClick?: OnClickHandler
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
  readOnly = false,
  onClick,
}) => (
  <div
    className={`dropdown-autocomplete dropdown-toggle ${buttonSize} ${buttonColor}${disabledClass(
      disabled
    )}`}
    style={toggleStyle}
    onClick={onClick}
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
      readOnly={readOnly}
    />
    <span className="caret" />
  </div>
)

export default DropdownInput
