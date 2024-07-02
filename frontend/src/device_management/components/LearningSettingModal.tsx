// Library
import React, {useEffect, useState} from 'react'
import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'

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
  notifyUpdateNetworkDeviceOrganizationFailed,
  notifyUpdateNetworkDeviceOrganizationSucceeded,
} from 'src/shared/copy/notifications'

interface Props {
  isVisible: boolean
  kapacitors: Kapacitor[]
  me?: Me
  organizations?: Organization[]
  orgLearningModel?: DevicesOrgData
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
    if (orgLearningModel) {
      const transformedData = transformOrgLearningModelToLearningOption(
        orgLearningModel
      )
      setLearningOption(transformedData)
    } else {
      setLearningOption(prevLearningOption => ({
        ...prevLearningOption,
        organization: me?.currentOrganization?.name || '',
      }))
    }
  }, [isVisible, orgLearningModel])

  const transformOrgLearningModelToLearningOption = (
    devicesOrgData: DevicesOrgData
  ): LearningOption => {
    return {
      organization:
        getOrganizationIdByName(organizations, devicesOrgData?.organization) ||
        me.currentOrganization.name,
      data_duration: devicesOrgData.data_duration,
      // TODO Parsing
      ml_function: devicesOrgData.ml_function,
      // TODO Parsing
      relearn_cycle: devicesOrgData.relearn_cycle || '',
      ai_kapacitor: devicesOrgData.ai_kapacitor,
    }
  }

  const setLearningDropdownState = (key: keyof LearningOption) => (
    value: DropdownItem
  ) => {
    setLearningOption({
      ...learningOption,
      ...{[key]: value.text},
    })
  }

  const setKapacitorDropdownState = (
    kapacitor: KapacitorForNetworkDeviceOrganization
  ) => {
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
    if (!!orgLearningModel) {
      updateDeviceOrganizationAjax()
    } else {
      createDeviceOrganizationAjax()
    }
  }

  const updateDeviceOrganizationAjax = async () => {
    const {organization, ...rest} = learningOption

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
    return kapacitors.length === 0
  }

  const LearningSettingModalMessage = () => {
    return (
      isKapacitorEmpty() && (
        <Form.Element>
          <div className="device-management-message">
            {MONITORING_MODAL_INFO.ML_DL_SettingKapacitorEmpty}
          </div>
        </Form.Element>
      )
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
                    newClassName={'form-group col-xs-12'}
                  />

                  <div
                    className="form-group col-xs-12"
                    style={{height: '95px'}}
                  >
                    <label>Kapacitor</label>
                    <DeviceManagementKapacitorDropdown
                      selectedKapacitor={learningOption.ai_kapacitor}
                      kapacitors={kapacitors}
                      setActiveKapacitor={setKapacitorDropdownState}
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
