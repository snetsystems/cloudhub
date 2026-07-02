import React, {useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import classnames from 'classnames'
import {ComponentColor, ComponentSize, ComponentStatus} from 'src/reusable_ui'
import DropdownButton from 'src/reusable_ui/components/dropdowns/DropdownButton'
import {ClickOutside} from 'src/shared/components/ClickOutside'
import {AlertGroupRule, RemoteDataState} from 'src/types'
import {URLMonitoringTarget} from '../types'
import {getURLMonitoring} from '../apis'
import URLTargetSelector from './URLTargetSelector'

interface Props {
  rule: AlertGroupRule
  onUpdateRule: (patch: Partial<AlertGroupRule>) => void
}

const URLAlertTargetSection: React.FC<Props> = ({rule, onUpdateRule}) => {
  const {t} = useTranslation()
  const [targets, setTargets] = useState<URLMonitoringTarget[]>([])
  const [targetsLoad, setTargetsLoad] = useState(RemoteDataState.NotStarted)
  const [targetPickerOpen, setTargetPickerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadTargets = async (): Promise<void> => {
      setTargetsLoad(RemoteDataState.Loading)
      try {
        const config = await getURLMonitoring()
        if (cancelled) {
          return
        }
        setTargets(config?.targets ?? [])
        setTargetsLoad(RemoteDataState.Done)
      } catch {
        if (cancelled) {
          return
        }
        setTargets([])
        setTargetsLoad(RemoteDataState.Error)
      }
    }

    loadTargets()

    return () => {
      cancelled = true
    }
  }, [])

  const closeTargetPicker = useCallback((): void => {
    setTargetPickerOpen(false)
  }, [])

  const toggleTargetPicker = useCallback((): void => {
    setTargetPickerOpen(open => !open)
  }, [])

  const handleTargetsChange = useCallback(
    (selectedTargetIds: string[]): void => {
      onUpdateRule({urlTargetIds: selectedTargetIds})
    },
    [onUpdateRule]
  )

  const selectedTargetIds = rule.urlTargetIds || []

  const dropdownStatus =
    targetsLoad === RemoteDataState.Loading
      ? ComponentStatus.Loading
      : targetsLoad === RemoteDataState.Error
      ? ComponentStatus.Error
      : ComponentStatus.Default

  const targetTriggerLabel =
    selectedTargetIds.length === 0
      ? t('url_alert_setting.select_url')
      : t('alert_group_rule.n_selected', {count: selectedTargetIds.length})

  return (
    <div className="rule-section url-alert-target-section">
      <h3 className="rule-section--heading">
        {t('url_alert_setting.target_title')}
      </h3>
      <div className="rule-section--body">
        <div className="alert-group-setting-row rule-section--row-first">
          <div className="alert-group-setting-label">
            {t('url_alert_setting.target_url')}
          </div>
          <div className="alert-group-setting-control">
            <div className="alert-group-setting-inputs">
              {targetsLoad === RemoteDataState.Error ? (
                <span className="alert-group-empty-text">
                  {t('url_alert_setting.failed_to_load_targets')}
                </span>
              ) : (
                <ClickOutside onClickOutside={closeTargetPicker}>
                  <div
                    className={classnames(
                      'dropdown dropdown-small dropdown-default',
                      'alert-group-target--dropdown-root'
                    )}
                  >
                    <DropdownButton
                      active={targetPickerOpen}
                      color={ComponentColor.Default}
                      size={ComponentSize.Small}
                      status={dropdownStatus}
                      onClick={toggleTargetPicker}
                      title={t('url_alert_setting.select_url_title')}
                    >
                      {targetTriggerLabel}
                    </DropdownButton>
                    {targetPickerOpen &&
                      targetsLoad === RemoteDataState.Done && (
                        <div className="dropdown--menu-container dropdown--onyx alert-group-target--host-dropdown-menu">
                          <div className="alert-group-target--host-dropdown-menu-inner">
                            <URLTargetSelector
                              targets={targets}
                              selectedTargetIds={selectedTargetIds}
                              onChange={handleTargetsChange}
                            />
                          </div>
                        </div>
                      )}
                  </div>
                </ClickOutside>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default URLAlertTargetSection
