import React from 'react'
import MatchingAliasDropdown from 'src/log_analysis/components/MatchingAliasDropdown'
import {DeviceType, DropdownItem} from 'src/types'

interface CollectingSourceDropdownProps {
  deviceType: DeviceType
  isFromAgent: boolean
  items: DropdownItem[]
  selected: string
  isOpen?: boolean
  isAuthorized?: boolean
  onChoose: (item: DropdownItem) => void
  onClick?: () => void
  onClose?: () => void
}

const CollectingSourceDropdown: React.FC<CollectingSourceDropdownProps> = ({
  items,
  selected,
  isOpen,
  isFromAgent,
  deviceType,
  isAuthorized,
  onChoose,
  onClick,
  onClose,
}) => (
  <>
    {deviceType === 'baremetal' && !isFromAgent && (
      <MatchingAliasDropdown
        items={items}
        isOpen={isOpen}
        useAutoComplete={true}
        disabled={!isAuthorized}
        onChoose={onChoose}
        onClick={onClick}
        onClose={onClose}
        selected={selected}
        className={'dropdown collecting-source-dropdown-50'}
      />
    )}
  </>
)

export default CollectingSourceDropdown
