import React, {PureComponent} from 'react'
import _ from 'lodash'

import PageSpinner from 'src/shared/components/PageSpinner'
import InputNumberClickToEdit from 'src/shared/components/InputNumberClickToEdit'

import {Button, ComponentColor, ComponentStatus} from 'src/reusable_ui'
import Container from 'src/reusable_ui/components/overlays/OverlayContainer'
import Body from 'src/reusable_ui/components/overlays/OverlayBody'
import TopologyRadioButton from 'src/hosts/components//TopologyRadioButton'

import {Notification} from 'src/types/notifications'
import {PreferenceType} from 'src/hosts/types'
import {RemoteDataState} from 'src/types'

interface Props {
  preferencesStatus: RemoteDataState
  preferenceTemperatureValues: string[]
  onChangeTemperatureInput: (
    temperatureType: PreferenceType['temperatureType'],
    temperatureValueType: PreferenceType['temperatureValueType'],
    temperatureValue: string
  ) => void
  onDismissOverlay: () => void
  onClickTemperatureResetButton: (
    temperatureType: PreferenceType['temperatureType']
  ) => void
  onChangeRadioButton: (
    temperatureType: PreferenceType['temperatureType']
  ) => void
  onClickTemperatureApplyButton: () => void
  onClickTemperatureOkButton: () => void
  notify: (message: Notification) => void
}

class TopologyPreferences extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  private get renderPreferencesHeader() {
    const {onClickTemperatureOkButton, onDismissOverlay} = this.props

    return (
      <div className="overlay--heading">
        <div id="preferences-title" className="overlay--title">
          {'Temperature Preferences'}
        </div>
        <Button
          customClass="temperature-cancel"
          text="Cancel"
          titleText="Cancel"
          onClick={onDismissOverlay}
        />
        <Button
          color={ComponentColor.Success}
          customClass="temperature-ok"
          text="OK"
          titleText="OK"
          onClick={() => {
            onClickTemperatureOkButton()
          }}
        />
      </div>
    )
  }

  private get SelectedTemperatureType(): PreferenceType['temperatureType'] {
    const {preferenceTemperatureValues} = this.props
    const temperatureType = _.filter(
      preferenceTemperatureValues,
      temperatureValue => temperatureValue.includes('active:1')
    ).map(item => {
      const selectedTemperatureTypeMatch = item.match(/type:(\w+),/)

      return selectedTemperatureTypeMatch
        ? (selectedTemperatureTypeMatch[1] as PreferenceType['temperatureType'])
        : 'inlet'
    })

    return temperatureType[0]
  }

  private getTemperatureValue(
    temperatureType: PreferenceType['temperatureType'],
    temperatureValueType: PreferenceType['temperatureValueType']
  ) {
    const {preferenceTemperatureValues} = this.props
    if (preferenceTemperatureValues.length === 0) return '0'

    const selectedTemperatureType = preferenceTemperatureValues.find(
      temperatureValue => temperatureValue.includes(`type:${temperatureType}`)
    )

    return selectedTemperatureType
      .split(',')
      .find(splittedValue => splittedValue.includes(`${temperatureValueType}:`))
      .split(':')[1]
  }

  private getResetColorClassName(
    temperatureType: PreferenceType['temperatureType']
  ): ComponentColor {
    return temperatureType === this.SelectedTemperatureType
      ? ComponentColor.Warning
      : ComponentColor.Default
  }

  private getResetStatus(
    temperatureType: PreferenceType['temperatureType']
  ): ComponentStatus {
    return temperatureType === this.SelectedTemperatureType
      ? ComponentStatus.Default
      : ComponentStatus.Disabled
  }

  private getResetButtonClassName(
    temperatureType: PreferenceType['temperatureType']
  ): string {
    return temperatureType === this.SelectedTemperatureType
      ? 'temperature-reset--active'
      : 'btn-default temperature-reset'
  }

  private get renderSetTemperaturePopup() {
    const {
      onChangeTemperatureInput,
      onClickTemperatureResetButton,
      onChangeRadioButton,
      onClickTemperatureApplyButton,
    } = this.props

    const selectedTemperatureType = this.SelectedTemperatureType

    return (
      <>
        <div>
          <span className="preferences-title--min">{'Min(°C)'}</span>
          <span className="preferences-title--max">{'Max(°C)'}</span>
        </div>
        <div className="preferences-td">
          <TopologyRadioButton
            id="temp_inside"
            checked={selectedTemperatureType === 'inside'}
            name="toppologyPreference"
            titleText="Inside"
            onChange={() => {
              onChangeRadioButton('inside')
            }}
          />
          <div className="temperature-type">CPU</div>
          <InputNumberClickToEdit
            disabled={selectedTemperatureType !== 'inside'}
            wrapperClass="fancytable--td temperature-range"
            placeholder="min"
            value={this.getTemperatureValue('inside', 'min')}
            onChange={(value: string) => {
              onChangeTemperatureInput('inside', 'min', value)
            }}
          />
          <span className="temperature-blank"> </span>
          <InputNumberClickToEdit
            disabled={selectedTemperatureType !== 'inside'}
            wrapperClass="fancytable--td temperature-range"
            placeholder="max"
            value={this.getTemperatureValue('inside', 'max')}
            onChange={(value: string) => {
              onChangeTemperatureInput('inside', 'max', value)
            }}
          />
          <Button
            color={this.getResetColorClassName('inside')}
            customClass={this.getResetButtonClassName('inside')}
            status={this.getResetStatus('inside')}
            text="Reset"
            titleText="Reset"
            onClick={() => {
              onClickTemperatureResetButton('inside')
            }}
          />
        </div>
        <div className="preferences-td">
          <TopologyRadioButton
            id="temp_inlet"
            checked={selectedTemperatureType === 'inlet'}
            name="toppologyPreference"
            titleText="Inlet"
            onChange={() => {
              onChangeRadioButton('inlet')
            }}
          />
          <div className="temperature-type">Inlet</div>
          <InputNumberClickToEdit
            disabled={selectedTemperatureType !== 'inlet'}
            wrapperClass="fancytable--td temperature-range"
            placeholder="min"
            value={this.getTemperatureValue('inlet', 'min')}
            onChange={(value: string) => {
              onChangeTemperatureInput('inlet', 'min', value)
            }}
          />
          <span className="temperature-blank"> </span>
          <InputNumberClickToEdit
            disabled={selectedTemperatureType !== 'inlet'}
            wrapperClass="fancytable--td temperature-range"
            placeholder="max"
            value={this.getTemperatureValue('inlet', 'max')}
            onChange={(value: string) => {
              onChangeTemperatureInput('inlet', 'max', value)
            }}
          />
          <Button
            color={this.getResetColorClassName('inlet')}
            customClass={this.getResetButtonClassName('inlet')}
            status={this.getResetStatus('inlet')}
            text="Reset"
            titleText="Reset"
            onClick={() => {
              onClickTemperatureResetButton('inlet')
            }}
          />
        </div>
        <div className="preferences-td--outlet">
          <TopologyRadioButton
            id="temp_outlet"
            checked={selectedTemperatureType === 'outlet'}
            name="toppologyPreference"
            titleText="Outlet"
            onChange={() => {
              onChangeRadioButton('outlet')
            }}
          />
          <div className="temperature-type">Outlet</div>
          <InputNumberClickToEdit
            disabled={selectedTemperatureType !== 'outlet'}
            wrapperClass="fancytable--td temperature-range"
            placeholder="min"
            value={this.getTemperatureValue('outlet', 'min')}
            onChange={(value: string) => {
              onChangeTemperatureInput('outlet', 'min', value)
            }}
          />
          <span className="temperature-blank"> </span>
          <InputNumberClickToEdit
            disabled={selectedTemperatureType !== 'outlet'}
            wrapperClass="fancytable--td temperature-range"
            placeholder="max"
            value={this.getTemperatureValue('outlet', 'max')}
            onChange={(value: string) => {
              onChangeTemperatureInput('outlet', 'max', value)
            }}
          />
          <Button
            color={this.getResetColorClassName('outlet')}
            customClass={this.getResetButtonClassName('outlet')}
            status={this.getResetStatus('outlet')}
            text="Reset"
            titleText="Reset"
            onClick={() => {
              onClickTemperatureResetButton('outlet')
            }}
          />
        </div>
        <div className="temperature-apply">
          <Button
            customClass="temperature-apply--button"
            text="Apply"
            titleText="Apply"
            onClick={() => {
              onClickTemperatureApplyButton()
            }}
          />
        </div>
      </>
    )
  }

  public render() {
    const {preferencesStatus, preferenceTemperatureValues} = this.props

    return (
      <>
        <div className="topology-preferences">
          {(preferencesStatus === RemoteDataState.Loading ||
            preferenceTemperatureValues.length === 0) && (
            <div className="topology-spinner">
              <PageSpinner />
            </div>
          )}
          <Container maxWidth={800}>
            {this.renderPreferencesHeader}
            <Body>{this.renderSetTemperaturePopup}</Body>
          </Container>
        </div>
      </>
    )
  }
}

export default TopologyPreferences
