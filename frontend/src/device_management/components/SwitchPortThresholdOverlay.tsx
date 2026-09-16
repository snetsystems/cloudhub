// Libraries
import React, {useEffect, useState} from 'react'
import {connect} from 'react-redux'
import {useTranslation} from 'react-i18next'
import {bindActionCreators} from 'redux'

// Components
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'
import Body from 'src/reusable_ui/components/overlays/OverlayBody'
import Heading from 'src/reusable_ui/components/overlays/OverlayHeading'
import Container from 'src/reusable_ui/components/overlays/OverlayContainer'

// APIs
import {
  getAllDevicesOrg,
  updateDeviceOrganization,
} from 'src/device_management/apis'

// Constants
import {DEFAULT_SWITCH_PORT_THRESHOLD} from 'src/device_management/constants/portLinkStatus'
import {
  notifyInvalidSwitchPortThreshold,
  notifySwitchPortThresholdSaved,
  notifySwitchPortThresholdSaveFailed,
} from 'src/shared/copy/notifications'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Types
import {DevicesOrgData, SwitchPortThreshold} from 'src/types'
import {Notification} from 'src/types/notifications'

interface Props {
  isOpen: boolean
  onClose: () => void
  organizationID: string
  threshold: SwitchPortThreshold
  onSaved: (threshold: SwitchPortThreshold) => void
  notify?: (message: Notification) => void
}

/**
 * The backend stores this as an int32. 3650 days (10 years) is comfortably
 * inside that range and far past any cutoff an operator could defend — no
 * port sits "maybe retired" for a decade — so it catches a fat-fingered value
 * (or one with a stray digit) before it reaches the API rather than silently
 * wrapping there.
 */
const MAX_LONG_DOWN_DAYS = 3650

/**
 * Empty is allowed while typing; only the value at save time has to parse.
 * long_down_days is a whole number of days, and 0 (off) is valid.
 */
const parse = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_LONG_DOWN_DAYS
    ? parsed
    : null
}

function SwitchPortThresholdOverlay({
  isOpen,
  onClose,
  organizationID,
  threshold,
  onSaved,
  notify,
}: Props) {
  const {t} = useTranslation()
  const [longDownDays, setLongDownDays] = useState(
    `${threshold.long_down_days}`
  )
  const [isSaving, setIsSaving] = useState(false)

  // Reopening after a save elsewhere should show the stored value, not the
  // one this component was first mounted with.
  useEffect(() => {
    if (isOpen) {
      setLongDownDays(`${threshold.long_down_days}`)
    }
  }, [isOpen, threshold])

  const handleSave = async () => {
    const nextDays = parse(longDownDays)

    if (nextDays === null) {
      notify(notifyInvalidSwitchPortThreshold())
      return
    }

    const next: SwitchPortThreshold = {long_down_days: nextDays}

    setIsSaving(true)
    try {
      // PATCH replaces every field it carries, so send the organization back
      // with only the threshold changed rather than a threshold-only body.
      const {data} = await getAllDevicesOrg()
      const org = (data?.organizations ?? []).find(
        (o: DevicesOrgData) => o.organization === organizationID
      )
      if (!org) {
        throw new Error(`organization ${organizationID} not found`)
      }

      await updateDeviceOrganization({
        id: organizationID,
        orgLearningModel: {
          data_duration: org.data_duration,
          ml_function: org.ml_function,
          learning_cron: org.learning_cron,
          ai_kapacitor: org.ai_kapacitor,
          process_count: org.process_count,
          switch_port_threshold: next,
        },
      })

      onSaved(next)
      notify(notifySwitchPortThresholdSaved())
      onClose()
    } catch (error) {
      notify(
        notifySwitchPortThresholdSaveFailed(error?.message ?? 'unknown error')
      )
    } finally {
      setIsSaving(false)
    }
  }

  const overlayActionButtons = (): JSX.Element => (
    <div className="btn-group--right">
      <button className="btn btn-sm btn-default" onClick={onClose}>
        {t('button.cancel', 'Cancel')}
      </button>
      <button
        className="btn btn-sm btn-success"
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? t('button.saving', 'Saving...') : t('button.save', 'Save')}
      </button>
    </div>
  )

  return (
    <OverlayTechnology visible={isOpen}>
      <Container maxWidth={340}>
        <Heading
          title={t('switch_ports.threshold.title', 'Switch Port Threshold')}
        >
          {overlayActionButtons()}
        </Heading>
        <Body>
          <div className="row optics-threshold-container">
            <div className="col-sm-12">
              <p className="optics-threshold--intro">
                {t(
                  'switch_ports.threshold.intro',
                  'Applies to every network device in this organization. A port down longer than this is treated as retired cabling (LONG DOWN) instead of an active fault.'
                )}
              </p>
            </div>
            <div className="col-sm-12">
              <label className="form-label">
                {t('switch_ports.threshold.long_down_days', 'Long Down (days)')}
              </label>
            </div>
            <div className="col-sm-12 option-section">
              <input
                className="form-control input-sm"
                type="number"
                step="1"
                min="0"
                max={MAX_LONG_DOWN_DAYS}
                value={longDownDays}
                onChange={e => setLongDownDays(e.target.value)}
              />
              <p className="optics-threshold--hint">
                {t(
                  'switch_ports.threshold.long_down_hint',
                  'Default {{value}}. 0 turns this off — ports stay DOWN no matter how long.',
                  {value: DEFAULT_SWITCH_PORT_THRESHOLD.long_down_days}
                )}
              </p>
            </div>
          </div>
        </Body>
      </Container>
    </OverlayTechnology>
  )
}

const mdtp = dispatch => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(null, mdtp)(SwitchPortThresholdOverlay)
