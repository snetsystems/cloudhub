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
  isFromAgent: boolean
  deviceType: DeviceType
  vendorItems: DropdownItem[]
  selectedVendor: string
  vendorIsOpen?: boolean
  isAuthorized?: boolean
  onVendorChoose: (item: DropdownItem) => void
  onVendorClick: () => void
  onVendorClose: () => void
  onVendorApply: () => void
  onVendorInputChange?: (value: string) => void
}

const VendorDropdown: React.FC<VendorDropdownProps> = ({
  isFromAgent,
  deviceType,
  vendorItems,
  selectedVendor,
  vendorIsOpen,
  isAuthorized,
  onVendorChoose,
  onVendorClick,
  onVendorClose,
  onVendorApply,
  onVendorInputChange,
}) => (
  <>
    {deviceType === 'ipmi' ||
    ((deviceType === 'baremetal' || deviceType === 'vm') && !isFromAgent) ? (
      <>
        <div className="vendor-dropdown-wrapper-title">{'Vendor'}</div>
        <div className="vendor-dropdown-wrapper">
          <MatchingAliasDropdown
            items={vendorItems}
            isOpen={vendorIsOpen}
            useAutoComplete={true}
            disabled={!isAuthorized}
            onChoose={onVendorChoose}
            onClick={onVendorClick}
            onClose={onVendorClose}
            selected={selectedVendor}
            onChange={onVendorInputChange}
            className={'dropdown vendor-dropdown-50'}
          />
          <Button
            size={ComponentSize.Small}
            color={ComponentColor.Primary}
            onClick={onVendorApply}
            text="Save"
            status={
              !isAuthorized ? ComponentStatus.Disabled : ComponentStatus.Default
            }
            active={!isAuthorized}
          />
        </div>
      </>
    ) : null}
  </>
)

export default VendorDropdown
