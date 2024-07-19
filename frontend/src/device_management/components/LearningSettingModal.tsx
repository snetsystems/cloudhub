// Library
import React, {useEffect, useState} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import _ from 'lodash'

// Components
import {
  Button,
  ComponentColor,
  ComponentStatus,
  Form,
  OverlayBody,
  OverlayContainer,
  OverlayHeading,
  OverlayTechnology,
} from 'src/reusable_ui'
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import Dropdown from 'src/shared/components/Dropdown'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import DeviceManagementKapacitorDropdown from 'src/device_management/components/DeviceManagementKapacitorDropdown'

// Constant
import {
  DEFAULT_LEARNING_OPTION,
  DEFAULT_CRON_SCHEDULE,
  DEFAULT_TASK,
  LEARN_TASK_PREFIX,
  MLFunctionMsg,
  MONITORING_MODAL_INFO,
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
  updateTaskForDeviceManagement,
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
} from 'src/device_management/utils'

// ETC
import {
  notifyCreateNetworkDeviceOrganizationFailed,
  notifyCreateNetworkDeviceOrganizationSucceeded,
  notifyTickscriptUpdateFailedWithMessage,
  notifyTickscriptUpdated,
  notifyUpdateNetworkDeviceOrganizationFailed,
  notifyUpdateNetworkDeviceOrganizationSucceeded,
} from 'src/shared/copy/notifications'

interface Props {
  isVisible: boolean
  kapacitors: Kapacitor[]
  me?: Me
  organizations?: Organization[]
  orgLearningModel?: DevicesOrgData[]
  source: Source
  sources: Source[]
  notify: (n: Notification) => void
  onClose: () => void
  setDeviceManagementIsLoading: (isLoading: boolean) => void
  getKapacitorsFromSelectedSource: (source: Source) => Promise<void>
  getDeviceAJAX: () => Promise<void>
  getNetworkDeviceOrganizationsAJAX: () => Promise<void>
}

function LearningSettingModal({
  isVisible,
  me,
  organizations,
  orgLearningModel,
  kapacitors,
  sources,
  source,
  notify,
  onClose,
  setDeviceManagementIsLoading,
  getDeviceAJAX,
  getNetworkDeviceOrganizationsAJAX,
  getKapacitorsFromSelectedSource,
}: Props) {
  // TODO Deprecated (createDeviceOrganizationAjax)
  const [isUpdateAfterCreate, setIsUpdateAfterCreate] = useState<boolean>(false)
  const [learningOption, setLearningOption] = useState<LearningOption>(
    DEFAULT_LEARNING_OPTION
  )
  const [isKapacitorInValid, setIsKapacitorInValid] = useState<boolean>(false)
  const [selectedKapacitor, setSelectedKapacitor] = useState<Kapacitor | null>(
    null
  )
  const [taskForTiskscriptUpdate, setTaskForTiskscriptUpdate] = useState<Task>(
    DEFAULT_TASK
  )
  const [cronSchedule, setCronSchedule] = useState<string>(
    DEFAULT_CRON_SCHEDULE
  )
  const [selectedSource, setSelectedSource] = useState<Source>(source)

  useEffect(() => {
    if (isVisible) {
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
        fetchAlertRule(organizationID)
        setCronSchedule(DEFAULT_CRON_SCHEDULE)
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
      setTaskForTiskscriptUpdate(DEFAULT_TASK)
      setCronSchedule(DEFAULT_CRON_SCHEDULE)

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
        setCronSchedule(DEFAULT_CRON_SCHEDULE)
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
    setTaskForTiskscriptUpdate(DEFAULT_TASK)
    setCronSchedule(DEFAULT_CRON_SCHEDULE)

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

      setDeviceManagementIsLoading(true)

      const kapacitors = await getKapacitors(_source)

      if (!isNetworkDeviceOrganizationValid) {
        setLearningOption(prevState => ({
          ...prevState,
          ai_kapacitor: convertKapacitor(kapacitors?.[0]),
        }))
        setIsKapacitorInValid(true)
        setSelectedKapacitor(kapacitors?.[0] || null)
        setDeviceManagementIsLoading(false)
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
      setDeviceManagementIsLoading(false)
    } catch (error) {
      setDeviceManagementIsLoading(false)
      setIsKapacitorInValid(true)
      setSelectedKapacitor(null)
      console.error(error)
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
    fetchAlertRuleByKapacitor(kapacitor)
    setSelectedKapacitor(kapacitor)
    setIsKapacitorInValid(false)
    setLearningOption({
      ...learningOption,
      ai_kapacitor: kapacitorForNetworkOrg,
    })
  }

  const fetchAlertRuleByKapacitor = async (kapacitor: Kapacitor) => {
    setTaskForTiskscriptUpdate(DEFAULT_TASK)
    setCronSchedule(DEFAULT_CRON_SCHEDULE)

    try {
      const organizationID = getOrganizationIdByName(
        organizations,
        selectedSource?.telegraf
      )

      setDeviceManagementIsLoading(true)
      await fetchSpecificAlertRule(kapacitor, organizationID)

      setDeviceManagementIsLoading(false)
    } catch (error) {
      setDeviceManagementIsLoading(false)
      console.error(error)
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
      // TODO Deprecated (createDeviceOrganizationAjax)
      createDeviceOrganizationAjax()

      // TODO Add instead of createDeviceOrganizationAjax
      // notify(
      //   notifyUpdateNetworkDeviceOrganizationFailed(
      //     'The selected organization has no devices available for learning.'
      //   )
      // )
    }
  }

  // TODO Deprecated (createDeviceOrganizationAjax)
  const createDeviceOrganizationAjax = async () => {
    const {organization, ...rest} = learningOption

    try {
      setDeviceManagementIsLoading(true)
      await createDeviceOrganization({
        orgLearningModel: {
          organization: organization,
          ...rest,
          cron_schedule: cronSchedule,
        },
      })

      setIsKapacitorInValid(false)
      setIsUpdateAfterCreate(true)
      notify(notifyCreateNetworkDeviceOrganizationSucceeded())
      finalizeApplyMLDLSettingAPIResponse()
    } catch (error) {
      notify(
        notifyCreateNetworkDeviceOrganizationFailed(
          error?.message || 'Unknown Error'
        )
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

    // TODO Deprecated (createDeviceOrganizationAjax)
    // const isNetworkDeviceOrganizationValid = isNetworkDeviceOrganizationCreatedWithSrcId(
    //   orgLearningModel,
    //   organization
    // )

    // if (!isNetworkDeviceOrganizationValid) {
    //   notifyFailure(
    //     'The selected organization has no devices available for learning.'
    //   )
    //   return
    // }

    if (isKapacitorNotSelected()) {
      notifyFailure('No kapacitors are available for configuration.')
      return
    }

    try {
      setDeviceManagementIsLoading(true)

      await updateDeviceOrganization({
        id: organization,
        orgLearningModel: {
          ...rest,
          task_status: getTaskStatus(),
          cron_schedule: cronSchedule,
        },
      })

      if (taskForTiskscriptUpdate?.tickscript) {
        await updateTask()
      }

      setIsKapacitorInValid(false)
      notify(notifyUpdateNetworkDeviceOrganizationSucceeded())
      finalizeApplyMLDLSettingAPIResponse()
    } catch (error) {
      notifyFailure(error?.message || 'Unknown Error')
      finalizeApplyMLDLSettingAPIResponse()
    }
  }

  const getTaskStatus = (): 1 | 2 => {
    const status = taskForTiskscriptUpdate?.status
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

  const finalizeApplyMLDLSettingAPIResponse = () => {
    setDeviceManagementIsLoading(false)
    getDeviceAJAX()
    getNetworkDeviceOrganizationsAJAX()
  }

  const fetchSpecificAlertRule = async (
    kapacitor: Kapacitor,
    organizationID: string
  ) => {
    const ruleID = `${LEARN_TASK_PREFIX}${organizationID}`

    try {
      const rule = await getSpecificRule(kapacitor, ruleID)

      saveFormatTaskForTickscriptUpdate(rule)
    } catch (error) {
      console.error(error)
    }
  }

  const saveFormatTaskForTickscriptUpdate = (fetchedRule: AlertRule) => {
    if (fetchedRule) {
      setTaskForTiskscriptUpdate({
        id: fetchedRule.id,
        name: fetchedRule.name,
        status: fetchedRule.status,
        tickscript: fetchedRule.tickscript,
        dbrps: fetchedRule.dbrps,
        type: fetchedRule.type,
      })

      setOriginalCronSchedule(fetchedRule)
    } else {
      setTaskForTiskscriptUpdate(DEFAULT_TASK)
      setCronSchedule(DEFAULT_CRON_SCHEDULE)
    }
  }

  const setOriginalCronSchedule = (rule: AlertRule) => {
    const cronRegex = /var cron = '([^']*)'/
    const match = rule?.tickscript?.match(cronRegex)
    const cronValue = match
      ? match?.[1] || DEFAULT_CRON_SCHEDULE
      : DEFAULT_CRON_SCHEDULE

    setCronSchedule(cronValue)
  }

  const updateTask = async () => {
    const organizationID = learningOption.organization

    try {
      const updatedTask = replaceCronInTickscript()
      const ruleID = `${LEARN_TASK_PREFIX}${organizationID}`
      await updateTaskForDeviceManagement(
        selectedKapacitor,
        updatedTask,
        ruleID
      )

      notify(notifyTickscriptUpdated())
    } catch (error) {
      console.error(
        notifyTickscriptUpdateFailedWithMessage(error.message || '')
      )
    }
  }

  const replaceCronInTickscript = (): Task => {
    const cronRegex = /var cron = '([^']*)'/
    let newTickscript = ''

    if (taskForTiskscriptUpdate?.tickscript) {
      newTickscript = taskForTiskscriptUpdate?.tickscript?.replace(
        cronRegex,
        `var cron = '${cronSchedule}'`
      )
    } else {
      throw new Error('Failed to update TICKscript')
    }

    return {
      ...taskForTiskscriptUpdate,
      tickscript: newTickscript,
    }
  }

  // TODO Deprecated (createDeviceOrganizationAjax)
  const LearningSettingModalMessage = () => {
    return (
      <>
        {isKapacitorEmpty() && (
          <Form.Element>
            <div className="device-management-message">
              {MONITORING_MODAL_INFO.ML_DL_SettingKapacitorEmpty}
            </div>
          </Form.Element>
        )}
      </>
    )
  }

  // const LearningSettingModalMessage = () => {
  //   const isNetworkDeviceOrganizationCreated = orgLearningModel.find(
  //     i =>
  //       i.organization ===
  //       getOrganizationIdByName(organizations, selectedSource.telegraf || '')
  //   )

  //   if (!isNetworkDeviceOrganizationCreated) {
  //     return (
  //       <Form.Element>
  //         <div className="device-management-message">
  //           {MONITORING_MODAL_INFO.ML_DL_Setting_NET_ORG_NOT_CREATED}
  //         </div>
  //       </Form.Element>
  //     )
  //   }

  //   return (
  //     <>
  //       {isKapacitorEmpty() ? (
  //         <Form.Element>
  //           <div className="device-management-message">
  //             {MONITORING_MODAL_INFO.ML_DL_SettingKapacitorEmpty}
  //           </div>
  //         </Form.Element>
  //       ) : (
  //         isKapacitorInValid && (
  //           <Form.Element>
  //             <div className="device-management-message">
  //               {MONITORING_MODAL_INFO.ML_DL_SettingKapacitorInvalid}
  //             </div>
  //           </Form.Element>
  //         )
  //       )}
  //     </>
  //   )
  // }

  const convertValueToKey = (value: string, obj: Object) => {
    const index = Object.values(obj).findIndex(i => i === value)
    return Object.keys(obj)[index]
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
                  <div className="form-group col-xs-12">
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
                  <WizardTextInput
                    value={`${learningOption.data_duration}`}
                    type="number"
                    label="Data Duration (days)"
                    onChange={setLearningInputState('data_duration')}
                  />
                  <WizardTextInput
                    value={cronSchedule}
                    type="text"
                    label="Cron Schedule"
                    onChange={setCronSchedule}
                    newClassName="form-group col-xs-12"
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

export default connect(mstp, mdtp, null)(LearningSettingModal)
