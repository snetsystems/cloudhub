import React from 'react'
import MatchingAliasDropdown from 'src/log_analysis/components/MatchingAliasDropdown'
import {
  Button,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
} from 'src/reusable_ui'
import {DeviceType, DropdownItem} from 'src/types'

interface VendorDropdownProps {
  items: DropdownItem[]
  selected: string
  isOpen?: boolean
  isAuthorized?: boolean
  deviceType: DeviceType
  onChoose: (item: DropdownItem) => void
  onClick?: () => void
  onClose?: () => void
  onApply?: () => void
}

const VendorDropdown: React.FC<VendorDropdownProps> = ({
  items,
  selected,
  isOpen,
  isAuthorized,
  deviceType,
  onChoose,
  onClick,
  onClose,
  onApply,
}) => (
  <>
    {(deviceType === 'baremetal' || deviceType === 'vm') && (
      <>
        <MatchingAliasDropdown
          items={items}
          isOpen={isOpen}
          useAutoComplete={true}
          disabled={!isAuthorized}
          onChoose={onChoose}
          onClick={onClick}
          onClose={onClose}
          selected={selected}
          className={'dropdown vendor-dropdown-50'}
        />

        <Button
          size={ComponentSize.Small}
          color={ComponentColor.Primary}
          onClick={onApply}
          text="Apply"
          status={
            !isAuthorized ? ComponentStatus.Disabled : ComponentStatus.Default
          }
          active={!isAuthorized}
        />
      </>
    )}
  </>
)

export default VendorDropdown
