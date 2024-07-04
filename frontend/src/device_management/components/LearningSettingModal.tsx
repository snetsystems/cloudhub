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
import {DEFAULT_KAPACITOR} from 'src/shared/constants'

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
import {getKapacitors, getSource} from 'src/shared/apis'

// Utils
import {getOrganizationIdByName} from 'src/device_management/utils'

// ETC
import {SUPERADMIN_ROLE, isUserAuthorized} from 'src/auth/Authorized'
import {
  notifyCreateNetworkDeviceOrganizationFailed,
  notifyCreateNetworkDeviceOrganizationSucceeded,
  notifyKapacitorConnectionFailed,
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
  notify: (n: Notification) => void
  onClose: () => void
  setDeviceManagementIsLoading: (isLoading: boolean) => void
  getDeviceAJAX: () => Promise<void>
  getNetworkDeviceOrganizationsAJAX: () => Promise<void>
}

function LearningSettingModal({
  isVisible,
  me,
  organizations,
  orgLearningModel,
  kapacitors,
  source,
  notify,
  onClose,
  setDeviceManagementIsLoading,
  getDeviceAJAX,
  getNetworkDeviceOrganizationsAJAX,
}: Props) {
  const [learningOption, setLearningOption] = useState<LearningOption>(
    DEFAULT_LEARNING_OPTION
  )
  const [isUpdateAfterCreate, setIsUpdateAfterCreate] = useState<boolean>(false)
  const [
    isStoredKapacitorInValid,
    setIsStoredKapacitorInValid,
  ] = useState<boolean>(false)
  const [storedKapacitor, setStoredKapacitor] = useState<Kapacitor>(
    DEFAULT_KAPACITOR
  )
  const [storedKapacitorName, setStoredKapacitorName] = useState<string>('')
  const [taskForTiskscriptUpdate, setTaskForTiskscriptUpdate] = useState<Task>(
    DEFAULT_TASK
  )
  const [cronSchedule, setCronSchedule] = useState<string>(
    DEFAULT_CRON_SCHEDULE
  )

  useEffect(() => {
    const organizationID = me.currentOrganization.id
    const isNetworkDeviceOrganizationCreated = orgLearningModel.find(
      i => i.organization === organizationID
    )

    if (isNetworkDeviceOrganizationCreated) {
      const transformedData = transformOrgLearningModelToLearningOption()
      setLearningOption(transformedData)
    } else {
      setLearningOption(() => ({
        data_duration: DEFAULT_LEARNING_OPTION.data_duration,
        ml_function: DEFAULT_LEARNING_OPTION.ml_function,
        organization: me?.currentOrganization?.name || '',
      }))
      setCronSchedule(DEFAULT_CRON_SCHEDULE)
      setStoredKapacitorName('')
    }
  }, [isVisible])

  const scrollMaxHeight = window.innerHeight * 0.4
  let dropdownCurOrg = [
    {
      ...me.currentOrganization,
      text: me.currentOrganization.name,
    },
  ]

  let dropdownOrg: any = null
  if (organizations) {
    dropdownOrg = organizations.map(role => ({
      ...role,
      text: role.name,
    }))
  }

  const transformOrgLearningModelToLearningOption = (): LearningOption => {
    const currentOrg = _.get(me, 'currentOrganization')
    const currentNetworkDeviceOrganization = orgLearningModel.find(
      i => i.organization === currentOrg.id
    )

    if (isVisible)
      checkValidKapacitor(
        currentNetworkDeviceOrganization.ai_kapacitor,
        currentOrg.id
      )

    return {
      organization: currentOrg.name,
      data_duration: currentNetworkDeviceOrganization.data_duration,
      ml_function: currentNetworkDeviceOrganization.ml_function,
      ai_kapacitor: currentNetworkDeviceOrganization.ai_kapacitor,
    }
  }

  const transformOrgLearningModelToLearningOptionWithOrganization = (
    organization: Organization
  ): LearningOption => {
    const currentNetworkDeviceOrganization = orgLearningModel.find(
      i => i.organization === organization.id
    )

    return {
      organization: organization.name,
      data_duration: currentNetworkDeviceOrganization.data_duration,
      ml_function: currentNetworkDeviceOrganization.ml_function,
      ai_kapacitor: currentNetworkDeviceOrganization.ai_kapacitor,
    }
  }

  const setLearningDropdownState = (key: keyof LearningOption) => (
    value: DropdownItem | Organization
  ) => {
    if (key === 'organization') {
      const isNetworkDeviceOrganizationCreated = orgLearningModel.find(
        i => i.organization === (value as Organization).id
      )

      if (isNetworkDeviceOrganizationCreated) {
        const transformedData = transformOrgLearningModelToLearningOptionWithOrganization(
          value as Organization
        )

        setLearningOption(transformedData)
        checkValidKapacitor(
          transformedData.ai_kapacitor,
          (value as Organization).id
        )
      } else {
        setLearningOption({
          data_duration: DEFAULT_LEARNING_OPTION.data_duration,
          ml_function: DEFAULT_LEARNING_OPTION.ml_function,
          organization: (value as Organization).name || '',
        })
        setCronSchedule(DEFAULT_CRON_SCHEDULE)
        setStoredKapacitorName('')
      }
    } else {
      setLearningOption({
        ...learningOption,
        ...{[key]: (value as DropdownItem).text},
      })
    }
  }

  const checkValidKapacitor = async (kapacitor, organizationID) => {
    const {srcId, kapaId} = kapacitor

    if (srcId === undefined || kapaId === undefined) {
      setIsStoredKapacitorInValid(true)
      return
    }

    setDeviceManagementIsLoading(true)

    try {
      const source = await getSource(srcId)
      const kapacitors = await getKapacitors(source)
      const aiKapacitor = kapacitors
        ? kapacitors.find(kapacitor => kapacitor.id === kapaId)
        : undefined
      const aiKapacitorName = aiKapacitor?.name || ''

      await fetchSpecificAlertRule(aiKapacitor, organizationID)

      setIsStoredKapacitorInValid(!aiKapacitor)
      setStoredKapacitor(aiKapacitor)
      setStoredKapacitorName(aiKapacitorName)
      setDeviceManagementIsLoading(false)
    } catch (error) {
      setDeviceManagementIsLoading(false)
      console.error(notifyKapacitorConnectionFailed())
    }
  }

  const setKapacitorDropdownState = (
    kapacitor: KapacitorForNetworkDeviceOrganization
  ) => {
    setIsStoredKapacitorInValid(false)
    setLearningOption({
      ...learningOption,
      ai_kapacitor: kapacitor,
    })
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
      i =>
        i.organization ===
        getOrganizationIdByName(organizations, learningOption?.organization)
    )

    if (isUpdateAfterCreate || isNetworkDeviceOrganizationCreated) {
      updateDeviceOrganizationAjax()
    } else {
      createDeviceOrganizationAjax()
    }
  }

  const updateDeviceOrganizationAjax = async () => {
    const {organization, ...rest} = learningOption

    if (isStoredKapacitorInValid) {
      notify(
        notifyUpdateNetworkDeviceOrganizationFailed(
          'The Kapacitor you registered has been deleted. Please update the Kapacitor.'
        )
      )
      return
    }

    try {
      setDeviceManagementIsLoading(true)

      await updateDeviceOrganization({
        id: getOrganizationIdByName(organizations, organization),
        orgLearningModel: {...rest, cron_schedule: cronSchedule},
      })
      await updateTask()

      notify(notifyUpdateNetworkDeviceOrganizationSucceeded())
      finalizeApplyMLDLSettingAPIResponse()
    } catch (error) {
      notify(notifyUpdateNetworkDeviceOrganizationFailed(error.message || ''))
      finalizeApplyMLDLSettingAPIResponse()
    }
  }

  const createDeviceOrganizationAjax = async () => {
    const {organization, ...rest} = learningOption

    try {
      setDeviceManagementIsLoading(true)
      await createDeviceOrganization({
        orgLearningModel: {
          organization: getOrganizationIdByName(organizations, organization),
          ...rest,
          cron_schedule: cronSchedule,
        },
      })

      setIsUpdateAfterCreate(true)
      notify(notifyCreateNetworkDeviceOrganizationSucceeded())
      finalizeApplyMLDLSettingAPIResponse()
    } catch (error) {
      notify(notifyCreateNetworkDeviceOrganizationFailed(error.message || ''))
      finalizeApplyMLDLSettingAPIResponse()
    }
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

  const saveFormatTaskForTickscriptUpdate = (storedTask: Task) => {
    if (storedTask) {
      setTaskForTiskscriptUpdate({
        id: storedTask.id,
        name: storedTask.name,
        status: storedTask.status,
        tickscript: storedTask.tickscript,
        dbrps: storedTask.dbrps,
        type: storedTask.type,
      })

      setOriginalCronSchedule(storedTask)
    }
  }

  const setOriginalCronSchedule = (task: Task) => {
    const cronRegex = /var cron = '([^']*)'/
    const match = task?.tickscript?.match(cronRegex)
    const cronValue = match
      ? match?.[1] || DEFAULT_CRON_SCHEDULE
      : DEFAULT_CRON_SCHEDULE

    setCronSchedule(cronValue)
  }

  const updateTask = async () => {
    const organizationID = getOrganizationIdByName(
      organizations,
      learningOption.organization
    )

    try {
      const updatedTask = replaceCronInTickscript()
      const ruleID = `${LEARN_TASK_PREFIX}${organizationID}`
      await updateTaskForDeviceManagement(storedKapacitor, updatedTask, ruleID)

      notify(notifyTickscriptUpdated())
    } catch (error) {
      notify(notifyTickscriptUpdateFailedWithMessage())
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

  const isKapacitorEmpty = (): boolean => {
    const isNetworkDeviceOrganizationCreated = orgLearningModel.find(
      i =>
        i.organization ===
        getOrganizationIdByName(organizations, learningOption.organization)
    )

    return !isNetworkDeviceOrganizationCreated && kapacitors.length === 0
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
          isStoredKapacitorInValid && (
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
                      disabled={!isUserAuthorized(me.role, SUPERADMIN_ROLE)}
                      items={me.superAdmin ? dropdownOrg : dropdownCurOrg}
                      onChoose={setLearningDropdownState('organization')}
                      selected={
                        learningOption?.organization ||
                        me?.currentOrganization?.name
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
                    label="Data Duration(days)"
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
                    <label>Kapacitor</label>
                    <DeviceManagementKapacitorDropdown
                      source={source}
                      selectedKapacitor={learningOption.ai_kapacitor}
                      kapacitors={kapacitors}
                      setActiveKapacitor={setKapacitorDropdownState}
                      kapacitorName={storedKapacitorName}
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
