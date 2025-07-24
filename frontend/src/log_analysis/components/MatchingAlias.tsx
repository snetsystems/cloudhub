import React from 'react'
import {
  Button,
  SlideToggle,
  ComponentSize,
  ComponentColor,
  ComponentStatus,
} from 'src/reusable_ui'
import MatchingAliasDropdown from 'src/log_analysis/components/MatchingAliasDropdown'
import {DropdownItem} from 'src/types'

interface MatchingAliasProps {
  toggleActive: boolean
  toggleDisabled?: boolean

  onApply?: () => void
  onToggleChange?: (active: boolean) => void
  dropdownItems: DropdownItem[]
  dropdownSelected: string
  dropdownIsOpen?: boolean
  isAuthorized?: boolean
  dropdownOnChoose: (item: DropdownItem) => void
  dropdownOnClick?: () => void
  dropdownOnClose?: () => void
}

const MatchingAlias: React.FC<MatchingAliasProps> = ({
  toggleActive = true,
  toggleDisabled = false,
  onApply,
  onToggleChange,
  dropdownItems = [],
  dropdownSelected = '',
  dropdownIsOpen,
  isAuthorized,
  dropdownOnChoose = () => {},
  dropdownOnClick,
  dropdownOnClose,
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
          selected={dropdownSelected}
          className={'dropdown matching-alias-dropdown-50'}
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
        <span>From Agent</span>

        <SlideToggle
          active={toggleDisabled || toggleActive}
          onChange={() => {
            onToggleChange(!toggleActive)
          }}
          size={ComponentSize.ExtraSmall}
          disabled={toggleDisabled}
        />
      </div>
    </>
  )
}

export default MatchingAlias
