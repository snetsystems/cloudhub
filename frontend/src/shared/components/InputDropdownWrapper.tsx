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

  React.useEffect(() => {
    const handleGlobalClick = (_: MouseEvent) => {
      if (isOpen) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('click', handleGlobalClick)
    }
    return () => {
      document.removeEventListener('click', handleGlobalClick)
    }
  }, [isOpen])

  return (
    <InputDropdown
      items={items}
      isOpen={isOpen}
      useAutoComplete={true}
      disabled={false}
      onChoose={handleChoose}
      onClick={() => setIsOpen(prev => !prev)}
      selected={selectedItem}
      className={className ?? 'dropdown'}
      onChange={onChange}
    />
  )
}

export default InputDropdownWrapper
