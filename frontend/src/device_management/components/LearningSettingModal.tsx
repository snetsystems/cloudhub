import React, {useEffect, useState} from 'react'
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
  SlideToggle,
} from 'src/reusable_ui'
import WizardTextInput from 'src/reusable_ui/components/wizard/WizardTextInput'
import Dropdown from 'src/shared/components/Dropdown'
import {bindActionCreators} from 'redux'
import {notify as notifyAction} from 'src/shared/actions/notifications'
import {connect} from 'react-redux'
import {DropdownItem, LearningOption, Me, Organization} from 'src/types'
import {SUPERADMIN_ROLE, isUserAuthorized} from 'src/auth/Authorized'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import {DEFAULT_LEARNING_OPTION, MLFunctionMsg} from '../constants'
import {DevicesOrgData, PredictionMode} from 'src/types/deviceManagement'
import {createDeviceOrganization, updateDeviceOrganization} from '../apis'
import {getOrganizationIdByName} from '../utils'

interface Props {
  isVisible: boolean
  onClose: () => void
  me?: Me
  organizations?: Organization[]
  isDefault?: boolean
  orgLearningModel?: DevicesOrgData
}

function LearningSettingModal({
  isVisible,
  onClose,
  me,
  organizations,
  orgLearningModel,
}: Props) {
  const scrollMaxHeight = window.innerHeight * 0.4
  const [learningOption, setLearningOption] = useState<LearningOption>(
    DEFAULT_LEARNING_OPTION
  )

  useEffect(() => {
    //initial value
    !!orgLearningModel && setLearningOption(orgLearningModel)
    console.log('orgLearningModel: ', orgLearningModel)
  }, [])

  const setLearningDropdownState = (key: keyof LearningOption) => (
    value: DropdownItem
  ) => {
    setLearningOption({
      ...learningOption,
      ...{[key]: value.text},
    })
  }

  const setLearningInputState = (key: keyof LearningOption) => (
    value: string
  ) => {
    setLearningOption({
      ...learningOption,
      ...{[key]: Number(value)},
    })
  }

  const onToggleChanger = () => {
    setLearningOption({
      ...learningOption,
      is_prediction_active: !learningOption.is_prediction_active,
    })
  }
  const onSubmit = () => {
    if (!!orgLearningModel) {
      //update api
      const {organization, ml_function, ...rest} = learningOption

      updateDeviceOrganization({
        id: getOrganizationIdByName(organizations, organization),
        orgLearningModel: {ml_function: ml_function, ...rest},
      })
    } else {
      //create api
      const {organization, ml_function, ...rest} = learningOption
      console.log({
        orgLearningModel: {
          ...rest,
          ml_function: ml_function,
          organization: getOrganizationIdByName(organizations, organization),
        },
      })

      createDeviceOrganization({
        orgLearningModel: {
          ...rest,
          ml_function: ml_function,
          organization: getOrganizationIdByName(organizations, organization),
        },
      })
    }
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
                      items={organizations.map(i => i.name)}
                      onChoose={setLearningDropdownState('organization')}
                      selected={learningOption?.organization}
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
                  <div className="form-group col-xs-6">
                    <label>Prediction Mode</label>
                    <Dropdown
                      items={Object.values(PredictionMode)}
                      onChoose={(value: DropdownItem) =>
                        setLearningDropdownState('prediction_mode')({
                          text: convertValueToKey(value.text, PredictionMode),
                        })
                      }
                      selected={PredictionMode[learningOption.prediction_mode]}
                      className="dropdown-stretch"
                    />
                  </div>

                  <WizardTextInput
                    value={`${learningOption.learn_cycle}`}
                    type="number"
                    label="Re-Learn Cycle(days)"
                    onChange={setLearningInputState('learn_cycle')}
                  />
                  <WizardTextInput
                    value={`${learningOption.data_duration}`}
                    type="number"
                    label="Data Duration(days)"
                    onChange={setLearningInputState('data_duration')}
                  />
                  <div className="form-group col-xs-6">
                    <label>Prediction Active</label>
                    <SlideToggle
                      active={learningOption.is_prediction_active}
                      onChange={onToggleChanger}
                      size={ComponentSize.ExtraSmall}
                    />
                  </div>
                </>
              </FancyScrollbar>
            </Form.Element>
            <Form.Footer>
              <Button
                status={ComponentStatus.Default}
                text="Apply"
                color={ComponentColor.Primary}
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
