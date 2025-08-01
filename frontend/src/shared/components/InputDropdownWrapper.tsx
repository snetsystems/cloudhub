import React, {useState} from 'react'
import {DropdownItem} from 'src/types'
import InputDropdown from './InputDropdown'

interface Props {
  items: DropdownItem[]
  selectedItem: string
  setSelectedItem: (item: string) => void
  className?: string
  onChange: (item: string) => void
  placeholder?: string
  disabled?: boolean
  autofocus?: boolean
}

const InputDropdownWrapper = ({
  items,
  selectedItem,
  setSelectedItem,
  className,
  onChange,
  placeholder,
  disabled,
  autofocus,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleChoose = (item: DropdownItem) => {
    setSelectedItem(item.text)
    setIsOpen(false)
  }

  const onClose = (value?: string) => {
    setIsOpen(false)
    if (!!value || value === '') {
      onChange(value)
    }
  }

  return (
    <InputDropdown
      items={items}
      isOpen={isOpen}
      useAutoComplete={true}
      disabled={disabled}
      onChoose={handleChoose}
      onClick={() => setIsOpen(prev => !prev)}
      selected={selectedItem}
      className={className ?? 'dropdown'}
      onChange={onChange}
      placeholder={placeholder}
      onClose={onClose}
      autofocus={autofocus}
    />
  )
}

export default InputDropdownWrapper
