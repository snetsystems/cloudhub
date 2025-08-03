import React from 'react'
import {
  Button,
  ComponentSize,
  ComponentColor,
  ComponentStatus,
  IconFont,
} from 'src/reusable_ui'
import MatchingAliasDropdown from 'src/log_analysis/components/MatchingAliasDropdown'
import AppNameDropdown from 'src/log_analysis/components/AppNameDropdown'
import {DropdownItem} from 'src/types'

interface AppNameMatchingAliasWrapper {
  isAuthorized?: boolean

  // App props
  appItems: DropdownItem[]
  selectedApp: string
  appIsOpen?: boolean
  onAppChoose: (item: DropdownItem) => void
  onAppClick: () => void
  onAppClose: () => void
  onApply: () => void

  // MatchingAlias props
  matchingAliasDropdownItems: DropdownItem[]
  selectedMatchingAliasDropdown: string
  matchingAliasDropdownIsOpen?: boolean
  matchingAliasDropdownOnChoose: (item: DropdownItem) => void
  matchingAliasDropdownOnClick?: () => void
  matchingAliasDropdownOnClose?: () => void
  onMatchingAliasInputDropdownChange: (value: string) => void
  selectedDeviceHostname?: string
}

const AppNameMatchingAliasWrapper: React.FC<AppNameMatchingAliasWrapper> = ({
  appItems,
  selectedApp,
  appIsOpen,
  isAuthorized,
  onAppChoose,
  onAppClick,
  onAppClose,
  onApply,
  matchingAliasDropdownItems = [],
  selectedMatchingAliasDropdown = '',
  matchingAliasDropdownIsOpen,
  matchingAliasDropdownOnChoose = () => {},
  matchingAliasDropdownOnClick,
  matchingAliasDropdownOnClose,
  onMatchingAliasInputDropdownChange,
  selectedDeviceHostname,
}) => {
  return (
    <div className="app-matching-alias-container">
      <div className="app-matching-alias-row">
        <div className="app-section">
          <div className="app-dropdown-wrapper-title">{'App Name'}</div>
          <div className="app-dropdown-wrapper">
            <AppNameDropdown
              items={appItems}
              isOpen={appIsOpen}
              useAutoComplete={true}
              disabled={!isAuthorized}
              onChoose={onAppChoose}
              onClick={onAppClick}
              onClose={onAppClose}
              selected={selectedApp}
              className={'dropdown app-dropdown-50'}
            />
          </div>
        </div>

        <div className="matching-alias-section">
          <div className="matching-alias-title">{'Matching Alias'}</div>
          <div className="matching-alias-dropdown-wrapper">
            <MatchingAliasDropdown
              items={matchingAliasDropdownItems}
              isOpen={matchingAliasDropdownIsOpen}
              useAutoComplete={true}
              disabled={!isAuthorized}
              onChoose={matchingAliasDropdownOnChoose}
              onClick={matchingAliasDropdownOnClick}
              onClose={matchingAliasDropdownOnClose}
              selected={selectedMatchingAliasDropdown}
              onChange={onMatchingAliasInputDropdownChange}
              className={'dropdown matching-alias-dropdown-50'}
              placeholder={selectedDeviceHostname}
            />
          </div>
        </div>

        <div className="apply-section">
          <Button
            size={ComponentSize.Small}
            color={ComponentColor.Primary}
            onClick={onApply}
            icon={IconFont.FloppyDisk}
            status={
              !isAuthorized ? ComponentStatus.Disabled : ComponentStatus.Default
            }
            active={!isAuthorized}
          />
        </div>
      </div>
    </div>
  )
}

export default AppNameMatchingAliasWrapper
