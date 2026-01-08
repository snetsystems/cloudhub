// Libraries
import React, {FunctionComponent} from 'react'

// Components
import {Radio, ButtonShape} from 'src/reusable_ui'

interface GraphOptionsBooleanOptionProps {
  onToggleActive: (value: boolean) => void
  labelTextActive: string
  labelTextInactive: string
  title: string
  value: boolean
  colWidth?: string
  disabled?: boolean
}

const GraphOptionsBooleanOption: FunctionComponent<GraphOptionsBooleanOptionProps> = ({
  onToggleActive,
  labelTextActive,
  labelTextInactive,
  title,
  value,
  colWidth,
  disabled,
}) => (
  <div
    className={`form-group ${colWidth} ${
      disabled ? 'disabled-form-group' : ''
    }`}
  >
    <label>{title}</label>
    <Radio shape={ButtonShape.StretchToFit}>
      <Radio.Button
        id={`graph-boolean-option--${title}-active`}
        value={value}
        active={value}
        onClick={() => onToggleActive(true)}
        titleText={`${labelTextActive}`}
      >
        {labelTextActive}
      </Radio.Button>
      <Radio.Button
        id={`graph-boolean-option--${title}-inactive`}
        value={!value}
        active={!value}
        onClick={() => onToggleActive(false)}
        titleText={`${labelTextInactive}`}
      >
        {labelTextInactive}
      </Radio.Button>
    </Radio>
  </div>
)

export default GraphOptionsBooleanOption
