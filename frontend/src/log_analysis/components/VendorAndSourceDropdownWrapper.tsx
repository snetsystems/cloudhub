import React from 'react'
import VendorDropdown from 'src/log_analysis/components/VendorDropdown'
import CollectingSourceDropdown from 'src/log_analysis/components/CollectingSourceDropdown'
import {DropdownItem, DeviceType} from 'src/types'

interface VendorAndSourceDropdownWrapperProps {
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

  // CollectingSourceDropdown props
  collectingSourceItems: DropdownItem[]
  selectedCollectingSource: string
  collectingSourceIsOpen: boolean
  onCollectingSourceChoose: (item: DropdownItem) => void
  onCollectingSourceClick: () => void
  onCollectingSourceClose: () => void
}

const VendorAndSourceDropdownWrapper: React.FC<VendorAndSourceDropdownWrapperProps> = ({
  deviceType,
  isFromAgent,
  // VendorDropdown props
  vendorItems,
  selectedVendor,
  vendorIsOpen,
  isAuthorized,
  onVendorChoose,
  onVendorClick,
  onVendorClose,
  onVendorApply,

  // CollectingSourceDropdown props
  collectingSourceItems,
  selectedCollectingSource,
  collectingSourceIsOpen,
  onCollectingSourceChoose,
  onCollectingSourceClick,
  onCollectingSourceClose,
}) => (
  <>
    {(deviceType === 'baremetal' || deviceType === 'vm') && (
      <>
        <div className="vendor-source-dropdown-wrapper-title">{'Vendor'}</div>
        <div className="vendor-source-dropdown-wrapper">
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
          <CollectingSourceDropdown
            isFromAgent={isFromAgent}
            deviceType={deviceType}
            items={collectingSourceItems}
            selected={selectedCollectingSource}
            isOpen={collectingSourceIsOpen}
            isAuthorized={isAuthorized}
            onChoose={onCollectingSourceChoose}
            onClick={onCollectingSourceClick}
            onClose={onCollectingSourceClose}
          />
        </div>
      </>
    )}
  </>
)

export default VendorAndSourceDropdownWrapper
