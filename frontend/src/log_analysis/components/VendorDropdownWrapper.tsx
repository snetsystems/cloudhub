import React from 'react'
import VendorDropdown from 'src/log_analysis/components/VendorDropdown'
import {DropdownItem, DeviceType} from 'src/types'

interface VendorDropdownWrapperProps {
  isFromAgent: boolean
  deviceType: DeviceType

  // VendorDropdown props
  vendorItems: DropdownItem[]
  selectedVendor: string
  vendorIsOpen?: boolean
  isAuthorized?: boolean
  onVendorChoose: (item: DropdownItem) => void
  onVendorClick: () => void
  onVendorClose: () => void
  onVendorApply: () => void
}

const VendorDropdownWrapper: React.FC<VendorDropdownWrapperProps> = ({
  deviceType,
  isFromAgent,
  vendorItems,
  selectedVendor,
  vendorIsOpen,
  isAuthorized,
  onVendorChoose,
  onVendorClick,
  onVendorClose,
  onVendorApply,
}) => (
  <>
    {(deviceType === 'baremetal' || deviceType === 'vm') && !isFromAgent && (
      <>
        <div className="vendor-dropdown-wrapper-title">{'Vendor'}</div>
        <div className="vendor-dropdown-wrapper">
          <VendorDropdown
            deviceType={deviceType}
            items={vendorItems}
            selected={selectedVendor}
            isOpen={vendorIsOpen}
            isAuthorized={isAuthorized}
            onChoose={onVendorChoose}
            onClick={onVendorClick}
            onClose={onVendorClose}
            onApply={onVendorApply}
          />
        </div>
      </>
    )}
  </>
)

export default VendorDropdownWrapper
