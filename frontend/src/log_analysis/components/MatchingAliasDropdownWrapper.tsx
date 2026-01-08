// Libraries
import React, {useState} from 'react'
import MatchingAliasDropdown from './MatchingAliasDropdown'

// Types
import {DropdownItem} from 'src/types'

const MatchingAliasDropdownWrapper = ({
  items,
  selectedItem,
  setSelectedItem,
}: {
  items: DropdownItem[]
  selectedItem: string
  setSelectedItem: (item: string) => void
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleChoose = (item: DropdownItem) => {
    setSelectedItem(item.text)
    setIsOpen(false)
  }

  return (
    <MatchingAliasDropdown
      items={items}
      isOpen={isOpen}
      useAutoComplete={true}
      disabled={false}
      onChoose={handleChoose}
      onClick={() => setIsOpen(prev => !prev)}
      onClose={() => setIsOpen(false)}
      selected={selectedItem}
      className={'dropdown'}
    />
  )
}

export default MatchingAliasDropdownWrapper
