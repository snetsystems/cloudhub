import _ from 'lodash'
import React from 'react'

// component
import {
  Form,
  Button,
  ComponentColor,
  ComponentSize,
  Input,
  InputType,
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  ComponentStatus,
} from 'src/reusable_ui'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'

import {CloudServiceProvider} from 'src/hosts/types'
import {RemoteDataState} from 'src/types'

// Decorators
import PageSpinner from 'src/shared/components/PageSpinner'

import {InventoryTopology} from 'src/hosts/containers/InventoryTopology'

interface Props {
  onCancel: () => void
  onFocus: () => void
  isVisible: boolean
  customStyle?: React.CSSProperties
  containerMaxWidth?: number
  provider: CloudServiceProvider
  cloudNamespace: string
  cloudAccessKey: string
  cloudSecretKey: string
  cloudSAEmail: string
  cloudSAKey: string
  isUpdateCloud: boolean
  loadingState: RemoteDataState
  onInputChange?: InventoryTopology['handleChangeInput']
  onTextAreaChange?: InventoryTopology['handleChangeTextArea']
  onAddNamespace?: InventoryTopology['handleAddNamespace']
  onUpdateNamespace?: InventoryTopology['handleUpdateNamespace']
  onKeyPressEnter?: InventoryTopology['handleKeyPressEnter']
  onEncrypt?: InventoryTopology['handleEncrypt']
}

const TopologyCSPMngModal = (props: Props): JSX.Element => {
  const {
    isVisible,
    loadingState,
    provider,
    isUpdateCloud,
    cloudNamespace,
    cloudAccessKey,
    cloudSecretKey,
    cloudSAEmail,
    cloudSAKey,
    onInputChange,
    onTextAreaChange,
    onAddNamespace,
    onUpdateNamespace,
    onKeyPressEnter,
    onEncrypt,
    onFocus,
    onCancel,
  } = props

  const title = (() => {
    if (provider === CloudServiceProvider.AWS) {
      return 'Region'
    } else if (provider === CloudServiceProvider.GCP) {
      return 'Project'
    }
    return ''
  })()

  const loadingSpinner = () => {
    let isLoading = false

    if (loadingState === RemoteDataState.Loading) {
      isLoading = true
    }

    return isLoading ? (
      <div
        style={{
          position: 'absolute',
          zIndex: 3,
          backgroundColor: 'rgba(0,0,0,0.5)',
          width: '100%',
          height: '100%',
        }}
      >
        <PageSpinner />
      </div>
    ) : null
  }

  const cspForm = (): JSX.Element => {
    return (
      <Form>
        <Form.Element label={title} colsXS={12}>
          <Input
            onChange={onInputChange('cloudNamespace')}
            value={cloudNamespace}
            placeholder={title}
            type={InputType.Text}
            status={isUpdateCloud && ComponentStatus.Disabled}
          />
        </Form.Element>
        {provider === CloudServiceProvider.AWS ? (
          <Form.Element label="Access Key" colsXS={12}>
            <Input
              onChange={onInputChange('cloudAccessKey')}
              value={cloudAccessKey}
              placeholder={'Access Key'}
              type={InputType.Password}
            />
          </Form.Element>
        ) : null}
        {provider === CloudServiceProvider.AWS ? (
          <Form.Element label="Secret Key" colsXS={12}>
            <Input
              onChange={onInputChange('cloudSecretKey')}
              value={cloudSecretKey}
              onFocus={() => {
                onFocus()
              }}
              onBlur={onEncrypt}
              onKeyDown={onKeyPressEnter}
              placeholder={'Secret Key'}
              type={InputType.Password}
            />
          </Form.Element>
        ) : null}
        {provider === CloudServiceProvider.GCP ? (
          <Form.Element label="Service Account Email Address" colsXS={12}>
            <Input
              onChange={onInputChange('cloudSAEmail')}
              value={cloudSAEmail}
              onKeyDown={onKeyPressEnter}
              placeholder={'Service Account Email Address'}
              type={InputType.Text}
            />
          </Form.Element>
        ) : null}
        {provider === CloudServiceProvider.GCP ? (
          <Form.Element label="Service Account Private Key" colsXS={12}>
            <div className="rule-builder--message" style={{padding: 0}}>
              <textarea
                onChange={onTextAreaChange('cloudSAKey')}
                className="form-control input-sm monotype"
                value={cloudSAKey}
                placeholder="Service Account Private Key"
              />
            </div>
          </Form.Element>
        ) : null}
        <Form.Footer>
          <Button
            color={ComponentColor.Default}
            onClick={() => {
              onCancel()
            }}
            size={ComponentSize.Medium}
            text={'Cancel'}
          />
          <Button
            color={ComponentColor.Primary}
            onClick={() => {
              isUpdateCloud ? onUpdateNamespace() : onAddNamespace()
            }}
            size={ComponentSize.Medium}
            text={isUpdateCloud ? `Update ${title}` : `Save ${title}`}
          />
        </Form.Footer>
      </Form>
    )
  }

  return (
    <OverlayTechnology visible={isVisible}>
      <OverlayContainer>
        <div style={{position: 'relative'}}>
          {loadingSpinner()}
          <OverlayHeading
            title={
              isUpdateCloud
                ? `UPDATE ${_.toUpper(title)}`
                : `ADD ${_.toUpper(title)}`
            }
            onDismiss={() => {
              onCancel()
            }}
          />
          <OverlayBody>{cspForm()}</OverlayBody>
        </div>
      </OverlayContainer>
    </OverlayTechnology>
  )
}

export default TopologyCSPMngModal
