// Library
import React, {useEffect, useState} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import _ from 'lodash'
import {InjectedRouter, withRouter, WithRouterProps} from 'react-router'

// Components
import {
  Button,
  ComponentColor,
  ComponentSize,
  ComponentStatus,
  Form,
  OverlayBody,
  OverlayContainer,
  OverlayHeading,
  OverlayTechnology,
  Radio,
} from 'src/reusable_ui'
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import Dropdown from 'src/shared/components/Dropdown'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import DeviceManagementKapacitorDropdown from 'src/device_management/components/DeviceManagementKapacitorDropdown'
import WizardNumberInput from 'src/reusable_ui/components/wizard/WizardNumberInput'

// Constant
import {
  DEFAULT_LEARNING_OPTION,
  DEFAULT_CRON_SCHEDULE,
  DEFAULT_TASK,
  LEARN_TASK_PREFIX,
  MLFunctionMsg,
  MONITORING_MODAL_INFO,
  DEFAULT_PROCESS_COUNT,
} from 'src/device_management/constants'

// Action
import {notify as notifyAction} from 'src/shared/actions/notifications'

// Type
import {
  DropdownItem,
  LearningOption,
  Me,
  Organization,
  Notification,
  Kapacitor,
  Source,
  Task,
  AlertRule,
  TimeZones,
} from 'src/types'
import {
  DevicesOrgData,
  KapacitorForNetworkDeviceOrganization,
} from 'src/types/deviceManagement'

// API
import {
  createDeviceOrganization,
  getSpecificRule,
  updateDeviceOrganization,
} from 'src/device_management/apis'
import {getKapacitors} from 'src/shared/apis'

// Utils
import {
  convertSourcesToDropdownItems,
  getSourceBySourceID,
  getOrganizationIdByName,
  getOrganizationNameByID,
  isNetworkDeviceOrganizationCreatedWithSrcId,
  getSourceByTelegrafDatabase,
  parseErrorMessage,
} from 'src/device_management/utils'
import {convertCronExpression} from 'src/utils/cronParser'

// ETC
import {
  notifyCreateNetworkDeviceOrganizationFailed,
  notifyCreateNetworkDeviceOrganizationSucceeded,
  notifyUpdateNetworkDeviceOrganizationFailed,
  notifyUpdateNetworkDeviceOrganizationSucceeded,
} from 'src/shared/copy/notifications'

interface Props extends WithRouterProps {
  isVisible: boolean
  kapacitors: Kapacitor[]
  me?: Me
  organizations?: Organization[]
  orgLearningModel?: DevicesOrgData[]
  source: Source
  sources: Source[]
  router: InjectedRouter
  notify: (n: Notification) => void
  onClose: () => void
  setDeviceManagementIsLoading: (isLoading: boolean) => void
  getKapacitorsFromSelectedSource: (source: Source) => Promise<void>
  refreshStateForDeviceManagement: () => void
}

function LearningSettingModal({
  isVisible,
  me,
  organizations,
  orgLearningModel,
  kapacitors,
  sources,
  source,
  router,
  notify,
  onClose,
  setDeviceManagementIsLoading,
  refreshStateForDeviceManagement,
  getKapacitorsFromSelectedSource,
}: Props) {
  const [isUpdateAfterCreate, setIsUpdateAfterCreate] = useState<boolean>(false)
  const [learningOption, setLearningOption] = useState<LearningOption>(
    DEFAULT_LEARNING_OPTION
  )
  const [isKapacitorInValid, setIsKapacitorInValid] = useState<boolean>(false)
  const [selectedKapacitor, setSelectedKapacitor] = useState<Kapacitor | null>(
    null
  )
  const [currentTask, setCurrentTask] = useState<Task>(DEFAULT_TASK)
  const [cronSchedule, setCronSchedule] = useState<string>(
    DEFAULT_CRON_SCHEDULE
  )
  const [processCount, setProcessCount] = useState<number>(
    DEFAULT_PROCESS_COUNT
  )
  const [selectedSource, setSelectedSource] = useState<Source>(source)
  const [
    isLearningSettingLoading,
    setIsLearningSettingLoading,
  ] = useState<boolean>(false)
  const [cronTimeZone, setCronTimeZone] = useState<TimeZones>(TimeZones.UTC)

  useEffect(() => {
    if (isVisible) {
      setIsUpdateAfterCreate(false)

      const organizationID = getOrganizationIdByName(
        organizations,
        selectedSource?.telegraf
      )
      const isNetworkDeviceOrganizationCreated = orgLearningModel.find(
        i => i.organization === organizationID
      )

      if (isNetworkDeviceOrganizationCreated) {
        const transformedData = transformOrgLearningModelToLearningOption()

        setLearningOption(transformedData)
        getKapacitorsBySelectedSource(organizationID)
        fetchAlertRule(organizationID)
      } else {
        setLearningOption(() => ({
          data_duration: DEFAULT_LEARNING_OPTION.data_duration,
          ml_function: DEFAULT_LEARNING_OPTION.ml_function,
          organization: organizationID,
        }))
        getKapacitorsBySelectedSource(organizationID)
        setCronSchedule(getCronSchduleByTimezone(DEFAULT_CRON_SCHEDULE))
        setProcessCount(DEFAULT_PROCESS_COUNT)
        fetchAlertRule(organizationID)
      }
    }
  }, [isVisible])

  const scrollMaxHeight = window.innerHeight * 0.4
  const availableSources =
    me.superAdmin && me.currentOrganization.id === 'default'
      ? sources
      : [source]

  const getKapacitorsBySelectedSource = organizationID => {
    const organizationName = getOrganizationNameByID(
      organizations,
      organizationID
    )
    const sourceForSuperAdmin = getSourceByTelegrafDatabase(
      sources,
      organizationName
    )
    const sourceForGetKapacitor =
      me.superAdmin && me.currentOrganization.id === 'default'
        ? sourceForSuperAdmin
        : source

    getKapacitorsFromSelectedSource(sourceForGetKapacitor)
  }

  const transformOrgLearningModelToLearningOption = (): LearningOption => {
    const organizationID = getOrganizationIdByName(
      organizations,
      selectedSource.telegraf
    )
    const currentNetworkDeviceOrganization = orgLearningModel.find(
      i => i.organization === organizationID
    )

    if (currentNetworkDeviceOrganization?.learning_cron) {
      setCronSchedule(
        getCronSchduleByTimezone(currentNetworkDeviceOrganization.learning_cron)
      )
    }

    if (currentNetworkDeviceOrganization?.process_count) {
      setProcessCount(currentNetworkDeviceOrganization.process_count)
    }

    return {
      organization: organizationID,
      data_duration: currentNetworkDeviceOrganization.data_duration,
      ml_function: currentNetworkDeviceOrganization.ml_function,
      ai_kapacitor: currentNetworkDeviceOrganization.ai_kapacitor,
    }
  }

  const transformOrgLearningModelToLearningOptionWithOrganization = (
    organizationID: string
  ): LearningOption => {
    const currentNetworkDeviceOrganization = orgLearningModel.find(
      i => i.organization === organizationID
    )

    if (currentNetworkDeviceOrganization?.learning_cron) {
      setCronSchedule(
        getCronSchduleByTimezone(currentNetworkDeviceOrganization.learning_cron)
      )
    }

    if (currentNetworkDeviceOrganization?.process_count) {
      setProcessCount(currentNetworkDeviceOrganization.process_count)
    }

    return {
      organization: organizationID,
      data_duration: currentNetworkDeviceOrganization.data_duration,
      ml_function: currentNetworkDeviceOrganization.ml_function,
      ai_kapacitor: currentNetworkDeviceOrganization.ai_kapacitor,
    }
  }

  const setLearningDropdownState = (key: keyof LearningOption) => (
    value: DropdownItem | Source
  ) => {
    if (key === 'organization') {
      setIsUpdateAfterCreate(false)
      setCurrentTask(DEFAULT_TASK)
      setCronSchedule(getCronSchduleByTimezone(DEFAULT_CRON_SCHEDULE))
      setProcessCount(DEFAULT_PROCESS_COUNT)

      const selectedSource = getSourceBySourceID(sources, (value as Source).id)
      const organizationID =
        getOrganizationIdByName(organizations, selectedSource?.telegraf) || ''

      const isNetworkDeviceOrganizationCreated = orgLearningModel.find(
        i => i.organization === organizationID
      )

      if (isNetworkDeviceOrganizationCreated) {
        const transformedData = transformOrgLearningModelToLearningOptionWithOrganization(
          organizationID
        )

        setLearningOption(transformedData)
      } else {
        setLearningOption({
          data_duration: DEFAULT_LEARNING_OPTION.data_duration,
          ml_function: DEFAULT_LEARNING_OPTION.ml_function,
          organization: organizationID || '',
        })
      }

      getKapacitorsBySelectedSource(organizationID)
      fetchAlertRule(organizationID)
      setSelectedSource(selectedSource)
    } else {
      setLearningOption({
        ...learningOption,
        ...{[key]: (value as DropdownItem).text},
      })
    }
  }

  const fetchAlertRule = async (organizationID: string) => {
    setCurrentTask(DEFAULT_TASK)

    try {
      const isNetworkDeviceOrganizationValid = isNetworkDeviceOrganizationCreatedWithSrcId(
        orgLearningModel,
        organizationID
      )

      const organizationName =
        getOrganizationNameByID(organizations, organizationID) || ''
      const _source = getSourceByTelegrafDatabase(sources, organizationName)

      if (!_source) {
        setIsKapacitorInValid(true)
        setSelectedKapacitor(null)
        return
      }

      setLoading(true)

      const kapacitors = await getKapacitors(_source)

      if (!isNetworkDeviceOrganizationValid) {
        setLearningOption(prevState => ({
          ...prevState,
          ai_kapacitor: convertKapacitor(kapacitors?.[0]),
        }))
        setSelectedKapacitor(kapacitors?.[0] || null)
        setIsKapacitorInValid(!kapacitors?.[0])
        setLoading(false)
        return
      }

      setLearningOption(prevState => ({
        ...prevState,
        ai_kapacitor: convertKapacitor(kapacitors?.[0]),
      }))
      setIsKapacitorInValid(!kapacitors?.[0])
      setSelectedKapacitor(kapacitors?.[0] || null)

      if (kapacitors?.[0]) {
        await fetchSpecificAlertRule(kapacitors?.[0], organizationID)
      }
      setLoading(false)
    } catch (error) {
      setLoading(false)
      setIsKapacitorInValid(true)
      setSelectedKapacitor(null)
      console.error(parseErrorMessage(error))
    }
  }

  const convertKapacitor = (
    kapacitor: Kapacitor
  ): KapacitorForNetworkDeviceOrganization => {
    if (!kapacitor) {
      return {
        srcId: '',
        kapaId: '',
        url: '',
      }
    }

    return {
      srcId: selectedSource.id,
      kapaId: kapacitor.id,
      url: kapacitor.url,
      username: kapacitor.username,
      password: kapacitor.password,
      insecure_skip_verify: kapacitor.insecureSkipVerify,
    }
  }

  const setKapacitorDropdownState = (
    kapacitorForNetworkOrg: KapacitorForNetworkDeviceOrganization,
    kapacitor: Kapacitor
  ) => {
    setCronSchedule(getCronSchduleByTimezone(DEFAULT_CRON_SCHEDULE))
    setProcessCount(DEFAULT_PROCESS_COUNT)
    fetchAlertRuleByKapacitor(kapacitor)
    setSelectedKapacitor(kapacitor)
    setIsKapacitorInValid(false)
    setLearningOption({
      ...learningOption,
      ai_kapacitor: kapacitorForNetworkOrg,
    })
  }

  const fetchAlertRuleByKapacitor = async (kapacitor: Kapacitor) => {
    setCurrentTask(DEFAULT_TASK)

    try {
      const organizationID = getOrganizationIdByName(
        organizations,
        selectedSource?.telegraf
      )

      setLoading(true)
      await fetchSpecificAlertRule(kapacitor, organizationID)

      setLoading(false)
    } catch (error) {
      setLoading(false)
      console.error(parseErrorMessage(error))
    }
  }

  const setLearningInputState = (key: keyof LearningOption) => (
    value: string
  ) => {
    if (key === 'data_duration') {
      setLearningOption({
        ...learningOption,
        [key]: Number(value),
      })
    } else {
      setLearningOption({
        ...learningOption,
        [key]: value,
      })
    }
  }

  const onSubmit = () => {
    const isNetworkDeviceOrganizationCreated = orgLearningModel.find(
      i => i.organization === learningOption?.organization
    )

    if (isUpdateAfterCreate || isNetworkDeviceOrganizationCreated) {
      updateDeviceOrganizationAjax()
    } else {
      createDeviceOrganizationAjax()
    }
  }

  const createDeviceOrganizationAjax = async () => {
    const {organization, ...rest} = learningOption

    const notifyCreateFailure = (message: string) => {
      notify(notifyCreateNetworkDeviceOrganizationFailed(message))
    }

    if (isKapacitorEmpty()) {
      notifyCreateFailure('No kapacitors are available for configuration.')
      return
    }

    if (isKapacitorNotSelected()) {
      notifyCreateFailure('No kapacitors are available for configuration.')
      return
    }

    const convertedCronSchedule =
      cronTimeZone === TimeZones.Local
        ? convertCronScheduleLocalToUTC(cronSchedule)
        : cronSchedule

    try {
      setLoading(true)
      await createDeviceOrganization({
        orgLearningModel: {
          organization: organization,
          ...rest,
          learning_cron: convertedCronSchedule,
          process_count: processCount,
        },
      })

      await fetchSpecificAlertRule(kapacitors?.[0], organization)
      setIsKapacitorInValid(false)
      setIsUpdateAfterCreate(true)
      notify(notifyCreateNetworkDeviceOrganizationSucceeded())
      finalizeApplyMLDLSettingAPIResponse()
    } catch (error) {
      notify(
        notifyCreateNetworkDeviceOrganizationFailed(parseErrorMessage(error))
      )
      finalizeApplyMLDLSettingAPIResponse()
    }
  }

  const updateDeviceOrganizationAjax = async () => {
    const {organization, ...rest} = learningOption

    const notifyFailure = (message: string) => {
      notify(notifyUpdateNetworkDeviceOrganizationFailed(message))
    }

    if (isKapacitorEmpty()) {
      notifyFailure('No kapacitors are available for configuration.')
      return
    }

    if (isKapacitorNotSelected()) {
      notifyFailure('No kapacitors are available for configuration.')
      return
    }

    try {
      setLoading(true)

      const convertedCronSchedule =
        cronTimeZone === TimeZones.Local
          ? convertCronScheduleLocalToUTC(cronSchedule)
          : cronSchedule

      await updateDeviceOrganization({
        id: organization,
        orgLearningModel: {
          ...rest,
          task_status: getTaskStatus(),
          learning_cron: convertedCronSchedule,
          process_count: processCount,
        },
      })

      await fetchSpecificAlertRule(kapacitors?.[0], organization)
      setIsKapacitorInValid(false)
      notify(notifyUpdateNetworkDeviceOrganizationSucceeded())
      finalizeApplyMLDLSettingAPIResponse()
    } catch (error) {
      notifyFailure(parseErrorMessage(error))
      finalizeApplyMLDLSettingAPIResponse()
    }
  }

  const getTaskStatus = (): 1 | 2 => {
    const status = currentTask?.status
    return status
      ? status === 'enabled'
        ? 2
        : 1
      : DEFAULT_LEARNING_OPTION.task_status
  }

  const isKapacitorEmpty = (): boolean => {
    return kapacitors.length === 0
  }

  const isKapacitorNotSelected = () => {
    return selectedKapacitor === null || selectedKapacitor === undefined
  }

  const setLoading = (isLoading: boolean) => {
    setDeviceManagementIsLoading(isLoading)
    setIsLearningSettingLoading(isLoading)
  }

  const finalizeApplyMLDLSettingAPIResponse = () => {
    setLoading(false)
    refreshStateForDeviceManagement()
  }

  const fetchSpecificAlertRule = async (
    kapacitor: Kapacitor,
    organizationID: string
  ) => {
    const ruleID = `${LEARN_TASK_PREFIX}${organizationID}`

    try {
      const rule = await getSpecificRule(kapacitor, ruleID)

      saveCurrentTask(rule)
    } catch (error) {
      console.error(parseErrorMessage(error))
    }
  }

  const saveCurrentTask = (fetchedRule: AlertRule) => {
    if (fetchedRule) {
      setCurrentTask({
        id: fetchedRule.id,
        name: fetchedRule.name,
        status: fetchedRule.status,
        tickscript: fetchedRule.tickscript,
        dbrps: fetchedRule.dbrps,
        type: fetchedRule.type,
      })

      setOriginalProcessCount(fetchedRule)
      setOriginalCronSchedule(fetchedRule)
    } else {
      setCurrentTask(DEFAULT_TASK)
      setCronSchedule(getCronSchduleByTimezone(DEFAULT_CRON_SCHEDULE))
      setProcessCount(DEFAULT_PROCESS_COUNT)
    }
  }

  const setOriginalProcessCount = (rule: AlertRule) => {
    const processCountRegex = /var procCnt = '([^']*)'/
    const match = rule?.tickscript?.match(processCountRegex)
    let processCountValue

    try {
      processCountValue = match ? Number(match?.[1]) : DEFAULT_PROCESS_COUNT
      if (isNaN(processCountValue)) {
        processCountValue = DEFAULT_PROCESS_COUNT
      }
    } catch (e) {
      processCountValue = DEFAULT_PROCESS_COUNT
    }

    setProcessCount(processCountValue)
  }

  const setOriginalCronSchedule = (rule: AlertRule) => {
    const cronRegex = /var cron = '([^']*)'/
    const match = rule?.tickscript?.match(cronRegex)
    const cronValue = match
      ? match?.[1] || DEFAULT_CRON_SCHEDULE
      : DEFAULT_CRON_SCHEDULE

    setCronSchedule(getCronSchduleByTimezone(cronValue))
  }

  const LearningSettingModalMessage = () => {
    return (
      <>
        {isKapacitorEmpty() ? (
          <Form.Element>
            <div className="device-management-message">
              {MONITORING_MODAL_INFO.ML_DL_SettingKapacitorEmpty}
            </div>
          </Form.Element>
        ) : (
          isKapacitorInValid && (
            <Form.Element>
              <div className="device-management-message">
                {MONITORING_MODAL_INFO.ML_DL_SettingKapacitorInvalid}
              </div>
            </Form.Element>
          )
        )}
      </>
    )
  }

  const convertValueToKey = (value: string, obj: Object) => {
    const index = Object.values(obj).findIndex(i => i === value)
    return Object.keys(obj)[index]
  }

  const handleProcessCountChange = (value: string) => {
    const numericValue = Number(value)

    if (!isNaN(numericValue)) {
      setProcessCount(numericValue)
    } else {
      setProcessCount(DEFAULT_PROCESS_COUNT)
    }
  }

  const renderTaskStatus = () => {
    if (isLearningSettingLoading) return <></>

    if (currentTask.status === 'enabled') {
      return (
        <div
          className="device--indicator indicator--primary flex-center"
          style={{
            fontWeight: 500,
            textAlign: 'center',
            paddingRight: '6px',
          }}
        >
          Enabled
        </div>
      )
    }

    return (
      <div
        className="device--indicator flex-center"
        style={{
          fontWeight: 500,
          textAlign: 'center',
          paddingRight: '6px',
        }}
      >
        Disabled
      </div>
    )
  }

  const handleClickAlertSettingButton = () => {
    const confirm = window.confirm(
      "If you make changes, they won't be saved.\nDo you want to continue?"
    )

    if (confirm) {
      router.push(`/sources/${selectedSource.id}/alert-rules`)
    }
  }

  const renderTimeZone = () => {
    return (
      <Radio
        size={ComponentSize.ExtraSmall}
        customClass="learning-model-cron--button"
      >
        <Radio.Button
          id="cron-timezone-utc"
          titleText="UTC"
          value={TimeZones.UTC}
          onClick={handleClickUTCTimezoneButton}
          active={cronTimeZone === TimeZones.UTC}
        >
          UTC
        </Radio.Button>
        <Radio.Button
          id="cron-timezone-local"
          titleText="Local"
          value={TimeZones.Local}
          onClick={handleClickLocalTimezoneButton}
          active={cronTimeZone === TimeZones.Local}
        >
          Local
        </Radio.Button>
      </Radio>
    )
  }

  const getCronSchduleByTimezone = _cronSchedule => {
    return cronTimeZone === TimeZones.Local
      ? convertCronScheduleUTCToLocal(_cronSchedule)
      : _cronSchedule
  }

  const convertCronScheduleLocalToUTC = _cronSchedule => {
    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    return convertCronExpression(_cronSchedule, localTimeZone, 'UTC').trim()
  }

  const handleClickUTCTimezoneButton = () => {
    if (cronTimeZone === TimeZones.UTC) return

    const convertedCronSchedule = convertCronScheduleLocalToUTC(cronSchedule)

    setCronTimeZone(TimeZones.UTC)
    setCronSchedule(convertedCronSchedule)
  }

  const convertCronScheduleUTCToLocal = _cronSchedule => {
    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    return convertCronExpression(_cronSchedule, 'UTC', localTimeZone).trim()
  }

  const handleClickLocalTimezoneButton = () => {
    if (cronTimeZone === TimeZones.Local) return

    const convertedCronSchedule = convertCronScheduleUTCToLocal(cronSchedule)

    setCronTimeZone(TimeZones.Local)
    setCronSchedule(convertedCronSchedule)
  }

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer maxWidth={600}>
        <OverlayHeading title={'ML/DL Setting'} onDismiss={onClose} />
        <OverlayBody>
          <Form>
            <Form.Element>
              <FancyScrollbar autoHeight={true} maxHeight={scrollMaxHeight}>
                <>
                  <div className="form-group col-xs-8">
                    <label>Organization</label>
                    <Dropdown
                      items={convertSourcesToDropdownItems(availableSources)}
                      onChoose={setLearningDropdownState('organization')}
                      selected={
                        getOrganizationNameByID(
                          organizations,
                          learningOption?.organization
                        ) || ''
                      }
                      className="dropdown-stretch"
                    />
                  </div>
                  <div className="form-group col-xs-4">
                    <label style={{height: '14px'}}></label>
                    <div className="task-enabled--setting">
                      {renderTaskStatus()}
                      <a
                        href="#"
                        onClick={e => {
                          e.preventDefault()
                          handleClickAlertSettingButton()
                        }}
                        title="Alert Setting"
                      >
                        (Setting)
                      </a>
                    </div>
                  </div>

                  <div className="form-group col-xs-6">
                    <label>ML Function</label>
                    <Dropdown
                      items={Object.values(MLFunctionMsg)}
                      onChoose={(value: DropdownItem) =>
                        setLearningDropdownState('ml_function')({
                          text: convertValueToKey(value.text, MLFunctionMsg),
                        })
                      }
                      selected={MLFunctionMsg[learningOption.ml_function]}
                      className="dropdown-stretch"
                    />
                  </div>
                  <WizardNumberInput
                    value={`${learningOption.data_duration}`}
                    type="number"
                    label="Data Duration (days)"
                    onChange={setLearningInputState('data_duration')}
                    min={1}
                  />
                  <WizardTextInput
                    value={cronSchedule}
                    type="text"
                    label="Cron Schedule"
                    onChange={setCronSchedule}
                    buttonComponent={renderTimeZone()}
                    labelClassName="learning-model-cron--labelClassName"
                  />
                  <WizardNumberInput
                    value={`${processCount}`}
                    type="number"
                    label="Process Count"
                    onChange={handleProcessCountChange}
                    min={1}
                    labelClassName="learning-model-processcount--labelClassName"
                  />
                  <div
                    className="form-group col-xs-12"
                    style={{height: '95px'}}
                  >
                    <label>Kapacitor (AI Engine)</label>
                    <DeviceManagementKapacitorDropdown
                      source={selectedSource}
                      selectedKapacitor={{
                        ...selectedKapacitor,
                        srcId: selectedSource?.id || '',
                        kapaId: selectedKapacitor?.id || '',
                      }}
                      kapacitors={kapacitors}
                      setActiveKapacitor={setKapacitorDropdownState}
                      kapacitorName={selectedKapacitor?.name || ''}
                    />
                  </div>

                  {LearningSettingModalMessage()}
                </>
              </FancyScrollbar>
            </Form.Element>
            <Form.Footer>
              <Button
                active={isKapacitorEmpty()}
                status={
                  isKapacitorEmpty()
                    ? ComponentStatus.Disabled
                    : ComponentStatus.Default
                }
                text="Apply"
                color={
                  isKapacitorEmpty()
                    ? ComponentColor.Default
                    : ComponentColor.Primary
                }
                onClick={() => {
                  onSubmit()
                }}
              />
              <Button
                text={'Close'}
                onClick={() => {
                  onClose()
                }}
              />
            </Form.Footer>
          </Form>
        </OverlayBody>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

const mstp = ({adminCloudHub: {organizations}, auth, links}) => ({
  organizations,
  auth,
  me: auth.me,
  links,
})

const mdtp = (dispatch: any) => ({
  notify: bindActionCreators(notifyAction, dispatch),
})

export default connect(mstp, mdtp, null)(withRouter(LearningSettingModal))
