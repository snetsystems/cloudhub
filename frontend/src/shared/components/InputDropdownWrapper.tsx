import React, {useState} from 'react'
import {DropdownItem} from 'src/types'
import {InputDropdown} from './InputDropdown'

interface Props {
  items: DropdownItem[]
  selectedItem: string
  setSelectedItem: (item: string) => void
  className?: string
  onChange: (item: string) => void
}

const InputDropdownWrapper = ({
  items,
  selectedItem,
  setSelectedItem,
  className,
  onChange,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleChoose = (item: DropdownItem) => {
    setSelectedItem(item.text)
    setIsOpen(false)
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
    />
  )
}

export default InputDropdownWrapper
