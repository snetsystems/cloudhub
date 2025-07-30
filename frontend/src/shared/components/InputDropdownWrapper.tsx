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
}

const InputDropdownWrapper = ({
  items,
  selectedItem,
  setSelectedItem,
  className,
  onChange,
  placeholder,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleChoose = (item: DropdownItem) => {
    setSelectedItem(item.text)
    setIsOpen(false)
  }



  const onClose = (value: string) => {
    setIsOpen(false)
    onChange(value)
  }

  return (
    <InputDropdown
      items={items}
      isOpen={isOpen}
      useAutoComplete={true}
      disabled={false}
      onChoose={handleChoose}
      onClick={() => setIsOpen(prev => !prev)}
      onClose={() => setIsOpen(false)}
      selected={selectedItem}
      className={className ?? 'dropdown'}
      onChange={onChange}
      placeholder={placeholder}
      onClose={onClose}
    />
  )
}

export default InputDropdownWrapper
