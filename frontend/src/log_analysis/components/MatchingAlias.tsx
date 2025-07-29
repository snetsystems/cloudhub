import React from 'react'
import {
  Button,
  SlideToggle,
  ComponentSize,
  ComponentColor,
  ComponentStatus,
} from 'src/reusable_ui'
import MatchingAliasDropdown from 'src/log_analysis/components/MatchingAliasDropdown'
import {DropdownItem, DeviceType} from 'src/types'

interface MatchingAliasProps {
  deviceType: DeviceType
  toggleActive: boolean
  toggleDisabled?: boolean
  onToggleChange?: (active: boolean) => void
  onApply?: () => void
  dropdownItems: DropdownItem[]
  selectedDropdown: string
  dropdownIsOpen?: boolean
  isAuthorized?: boolean
  dropdownOnChoose: (item: DropdownItem) => void
  dropdownOnClick?: () => void
  dropdownOnClose?: () => void
  onInputDropdownChange: (value: string) => void
}

const MatchingAlias: React.FC<MatchingAliasProps> = ({
  deviceType,
  toggleActive = true,
  toggleDisabled = false,
  onApply,
  onToggleChange,
  dropdownItems = [],
  selectedDropdown = '',
  dropdownIsOpen,
  isAuthorized,
  dropdownOnChoose = () => {},
  dropdownOnClick,
  dropdownOnClose,
  onInputDropdownChange,
}) => {
  return (
    <>
      <div className="log-analysis-matching-alias-title">
        {'Matching Alias'}
      </div>
      <div className="log-analysis-matching-alias">
        <MatchingAliasDropdown
          items={dropdownItems}
          isOpen={dropdownIsOpen}
          useAutoComplete={true}
          disabled={!isAuthorized}
          onChoose={dropdownOnChoose}
          onClick={dropdownOnClick}
          onClose={dropdownOnClose}
          selected={selectedDropdown}
          onChange={onInputDropdownChange}
          className={
            deviceType === 'ipmi'
              ? 'matching-alias-dropdown-ipmi'
              : 'dropdown matching-alias-dropdown-50'
          }
        />
        <Button
          size={ComponentSize.Small}
          color={ComponentColor.Primary}
          onClick={onApply}
          text="Save"
          status={
            !isAuthorized ? ComponentStatus.Disabled : ComponentStatus.Default
          }
          active={!isAuthorized}
        />
        {deviceType !== 'ipmi' && (
          <>
            <span>From Agent</span>
            <SlideToggle
              active={toggleDisabled || toggleActive}
              onChange={() => {
                onToggleChange(!toggleActive)
              }}
              size={ComponentSize.ExtraSmall}
              disabled={toggleDisabled}
            />
          </>
        )}
      </div>
    </>
  )
}

export default MatchingAlias
