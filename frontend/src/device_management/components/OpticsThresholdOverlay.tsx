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
import {getKapacitors} from 'src/shared/apis'

// Components
import DeviceManagementKapacitorDropdown from 'src/device_management/components/DeviceManagementKapacitorDropdown'

// Constants
import {DEFAULT_OPTICS_THRESHOLD} from 'src/device_management/constants/opticsThreshold'
import {
  notifyOpticsKapacitorRequired,
  notifyInvalidOpticsThreshold,
  notifyOpticsThresholdSaved,
  notifyOpticsThresholdSaveFailed,
} from 'src/shared/copy/notifications'

// Actions
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Types
import {DevicesOrgData, Kapacitor, OpticsThreshold, Source} from 'src/types'
import {Notification} from 'src/types/notifications'

interface Props {
  isOpen: boolean
  onClose: () => void
  organizationID: string
  threshold: OpticsThreshold
  /** The cell's data source, used only to list the Kapacitors it can reach. */
  source?: Source
  onSaved: (threshold: OpticsThreshold) => void
  notify?: (message: Notification) => void
}

/** Empty is allowed while typing; only the value at save time has to parse. */
const parse = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function OpticsThresholdOverlay({
  isOpen,
  onClose,
  organizationID,
  threshold,
  source,
  onSaved,
  notify,
}: Props) {
  const {t} = useTranslation()
  const [rxLow, setRxLow] = useState(`${threshold.rx_low_dbm}`)
  const [txLow, setTxLow] = useState(`${threshold.tx_low_dbm}`)
  const [tempHigh, setTempHigh] = useState(`${threshold.temp_high_c}`)
  const [alertEnabled, setAlertEnabled] = useState(!!threshold.alert_enabled)
  const [kapacitors, setKapacitors] = useState<Kapacitor[]>([])
  const [kapacitorID, setKapacitorID] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  // Only worth loading while the dialog is open, and only the source knows
  // which Kapacitors are reachable.
  useEffect(() => {
    if (!isOpen || !source) {
      return
    }
    let isCancelled = false

    getKapacitors(source)
      .then(list => {
        if (!isCancelled) {
          setKapacitors(list ?? [])
        }
      })
      .catch(() => {
        // An empty list renders a disabled dropdown, which reads correctly.
      })

    return () => {
      isCancelled = true
    }
  }, [isOpen, source])

  // Reopening after a save elsewhere should show the stored values, not the
  // ones this component was first mounted with.
  useEffect(() => {
    if (isOpen) {
      setRxLow(`${threshold.rx_low_dbm}`)
      setTxLow(`${threshold.tx_low_dbm}`)
      setTempHigh(`${threshold.temp_high_c}`)
      setAlertEnabled(!!threshold.alert_enabled)
    }
  }, [isOpen, threshold])

  // The org holds the selection; seed the dropdown from it when the dialog opens.
  useEffect(() => {
    if (!isOpen) {
      return
    }
    let isCancelled = false

    getAllDevicesOrg()
      .then(({data}) => {
        if (isCancelled) {
          return
        }
        const org = (data?.organizations ?? []).find(
          (o: DevicesOrgData) => o.organization === organizationID
        )
        setKapacitorID(org?.optics_kapacitor_id ?? '')
      })
      .catch(() => {
        // Leave it unselected; saving then asks for a choice.
      })

    return () => {
      isCancelled = true
    }
  }, [isOpen, organizationID])

  const handleSave = async () => {
    const next: OpticsThreshold = {
      rx_low_dbm: parse(rxLow),
      tx_low_dbm: parse(txLow),
      temp_high_c: parse(tempHigh),
      alert_enabled: alertEnabled,
    }

    if (
      next.rx_low_dbm === null ||
      next.tx_low_dbm === null ||
      next.temp_high_c === null
    ) {
      notify(notifyInvalidOpticsThreshold())
      return
    }

    // An alert with nowhere to run would save silently and never fire.
    if (alertEnabled && !kapacitorID) {
      notify(notifyOpticsKapacitorRequired())
      return
    }

    setIsSaving(true)
    try {
      // PATCH replaces every field it carries, so send the organization back
      // with only the thresholds changed rather than a threshold-only body.
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
          optics_threshold: next,
          // Kept as a string end to end: these IDs exceed the range JavaScript
          // numbers represent exactly, and Number() silently rounds them.
          optics_kapacitor_id: kapacitorID || '0',
        },
      })

      onSaved(next)
      notify(notifyOpticsThresholdSaved())
      onClose()
    } catch (error) {
      notify(notifyOpticsThresholdSaveFailed(error?.message ?? 'unknown error'))
    } finally {
      setIsSaving(false)
    }
  }

  const selectedKapacitor = kapacitors.find(k => `${k.id}` === kapacitorID)

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

  const field = (
    label: string,
    hint: string,
    value: string,
    setValue: (next: string) => void
  ) => (
    <>
      <div className="col-sm-12">
        <label className="form-label">{label}</label>
      </div>
      <div className="col-sm-12 option-section">
        <input
          className="form-control input-sm"
          type="number"
          step="0.1"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
        <p className="optics-threshold--hint">{hint}</p>
      </div>
    </>
  )

  return (
    <OverlayTechnology visible={isOpen}>
      <Container maxWidth={340}>
        <Heading title={t('optics.threshold.title', 'Optics Thresholds')}>
          {overlayActionButtons()}
        </Heading>
        <Body>
          <div className="row optics-threshold-container">
            <div className="col-sm-12">
              <p className="optics-threshold--intro">
                {t(
                  'optics.threshold.intro',
                  'Applies to every network device in this organization. A port is flagged when its optical power falls below the low threshold, or its temperature rises above the high threshold.'
                )}
              </p>
            </div>
            {field(
              t('optics.threshold.rx_low', 'Rx Power Low (dBm)'),
              t(
                'optics.threshold.power_hint',
                'Below this counts as weak signal. Default {{value}}.',
                {value: DEFAULT_OPTICS_THRESHOLD.rx_low_dbm}
              ),
              rxLow,
              setRxLow
            )}
            {field(
              t('optics.threshold.tx_low', 'Tx Power Low (dBm)'),
              t(
                'optics.threshold.power_hint',
                'Below this counts as weak signal. Default {{value}}.',
                {value: DEFAULT_OPTICS_THRESHOLD.tx_low_dbm}
              ),
              txLow,
              setTxLow
            )}
            {field(
              t('optics.threshold.temp_high', 'Temperature High (°C)'),
              t(
                'optics.threshold.temp_hint',
                'Above this counts as overheating. Default {{value}}.',
                {value: DEFAULT_OPTICS_THRESHOLD.temp_high_c}
              ),
              tempHigh,
              setTempHigh
            )}
            <div className="col-sm-12 option-section optics-threshold--alert">
              <label className="optics-threshold--toggle">
                <input
                  type="checkbox"
                  checked={alertEnabled}
                  onChange={e => setAlertEnabled(e.target.checked)}
                />
                <span>
                  {t('optics.threshold.alert_enabled', 'Raise an alert')}
                </span>
              </label>
              <p className="optics-threshold--hint">
                {t(
                  'optics.threshold.alert_hint',
                  'Uses the same thresholds, evaluated continuously whether or not anyone is watching this page.'
                )}
              </p>
              {alertEnabled && (
                <div className="optics-threshold--kapacitor">
                  <label className="form-label">
                    {t('optics.threshold.kapacitor', 'Kapacitor')}
                  </label>
                  <DeviceManagementKapacitorDropdown
                    source={source}
                    kapacitors={kapacitors}
                    kapacitorName={selectedKapacitor?.name ?? ''}
                    // Only the URL is rendered; the credentials the shape also
                    // carries are not this component's business.
                    selectedKapacitor={{
                      srcId: source?.id ?? '',
                      kapaId: kapacitorID,
                      url: selectedKapacitor?.url ?? '',
                      username: '',
                      password: '',
                      insecure_skip_verify: false,
                    }}
                    setActiveKapacitor={(_, kapacitor) =>
                      setKapacitorID(kapacitor.id)
                    }
                  />
                  <p className="optics-threshold--hint">
                    {t(
                      'optics.threshold.kapacitor_hint',
                      'Where the alert task runs. A data source can have several, so pick the one that owns alerting.'
                    )}
                  </p>
                </div>
              )}
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

export default connect(null, mdtp)(OpticsThresholdOverlay)
