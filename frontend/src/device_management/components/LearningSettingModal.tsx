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
} from 'src/types'
import {
  DevicesOrgData,
  KapacitorForNetworkDeviceOrganization,
} from 'src/types/deviceManagement'

// API
import {
  createDeviceOrganization,
  updateDeviceOrganization,
} from 'src/device_management/apis'

// Utils
import {getOrganizationIdByName} from 'src/device_management/utils'

// ETC
import {SUPERADMIN_ROLE, isUserAuthorized} from 'src/auth/Authorized'
import {
  notifyCreateNetworkDeviceOrganizationFailed,
  notifyCreateNetworkDeviceOrganizationSucceeded,
  notifyKapacitorConnectionFailed,
  notifyUpdateNetworkDeviceOrganizationFailed,
  notifyUpdateNetworkDeviceOrganizationSucceeded,
} from 'src/shared/copy/notifications'
import {getKapacitors, getSource} from 'src/shared/apis'

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
  const scrollMaxHeight = window.innerHeight * 0.4
  const [learningOption, setLearningOption] = useState<LearningOption>(
    DEFAULT_LEARNING_OPTION
  )
  const [isCreated, setIsCreated] = useState<boolean>(false)
  const [
    isStoredKapacitorInValid,
    setIsStoredKapacitorInValid,
  ] = useState<boolean>(false)
  const [storedKapacitorName, setStoredKapacitorName] = useState<string>('')

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
        relearn_cycle: DEFAULT_LEARNING_OPTION.relearn_cycle,
        organization: me?.currentOrganization?.name || '',
      }))
    }
  }, [isVisible])

  const transformOrgLearningModelToLearningOption = (): LearningOption => {
    const currentOrg = _.get(me, 'currentOrganization')
    const currentNetworkDeviceOrganization = orgLearningModel.find(
      i => i.organization === currentOrg.id
    )

    if (isVisible)
      checkValidKapacitor(currentNetworkDeviceOrganization.ai_kapacitor)

    return {
      organization: currentOrg.name,
      data_duration: currentNetworkDeviceOrganization.data_duration,
      ml_function: currentNetworkDeviceOrganization.ml_function,
      // TODO Parsing
      relearn_cycle: currentNetworkDeviceOrganization.relearn_cycle || '',
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
      // TODO Parsing
      relearn_cycle: currentNetworkDeviceOrganization.relearn_cycle || '',
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
        checkValidKapacitor(transformedData.ai_kapacitor)
      } else {
        setLearningOption({
          data_duration: DEFAULT_LEARNING_OPTION.data_duration,
          ml_function: DEFAULT_LEARNING_OPTION.ml_function,
          relearn_cycle: DEFAULT_LEARNING_OPTION.relearn_cycle,
          organization: (value as Organization).name || '',
        })
      }
    } else {
      setLearningOption({
        ...learningOption,
        ...{[key]: (value as DropdownItem).text},
      })
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

    if (isCreated || isNetworkDeviceOrganizationCreated) {
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
        orgLearningModel: {...rest},
      })

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
        },
      })

      setIsCreated(true)
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

  const convertValueToKey = (value: string, obj: Object) => {
    const index = Object.values(obj).findIndex(i => i === value)
    return Object.keys(obj)[index]
  }

  const isKapacitorEmpty = (): boolean => {
    const isNetworkDeviceOrganizationCreated = orgLearningModel.find(
      i =>
        i.organization ===
        getOrganizationIdByName(organizations, learningOption.organization)
    )

    return !isNetworkDeviceOrganizationCreated && kapacitors.length === 0
  }

  const checkValidKapacitor = async kapacitor => {
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

      setIsStoredKapacitorInValid(!aiKapacitor)
      setStoredKapacitorName(aiKapacitorName)
      setDeviceManagementIsLoading(false)
    } catch (error) {
      setDeviceManagementIsLoading(false)
      console.error(notifyKapacitorConnectionFailed())
    }
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
                    value={`${learningOption.relearn_cycle}`}
                    type="text"
                    label="ReLearn Cycle"
                    onChange={setLearningInputState('relearn_cycle')}
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
