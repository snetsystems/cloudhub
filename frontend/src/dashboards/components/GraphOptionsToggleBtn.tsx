import React, {FunctionComponent} from 'react'
import {Radio, ButtonShape} from 'src/reusable_ui'

interface GraphOptionsToggleBtnProps {
  title: string
  GraphOptionsOptions: GraphOptionsOptions[]
  colWidth?: string
  disabled?: boolean
}

interface GraphOptionsOptions {
  title: string
  value: string | number | boolean
  active: boolean
  onClick: () => void
  titleText: string
}

const GraphOptionsToggleBtn: FunctionComponent<GraphOptionsToggleBtnProps> = ({
  colWidth,
  disabled,
  title,
  GraphOptionsOptions,
}) => {
  return (
    <div
      className={`form-group ${colWidth} ${
        disabled ? 'disabled-form-group' : ''
      }`}
    >
      <label>{title}</label>
      <Radio shape={ButtonShape.StretchToFit}>
        {GraphOptionsOptions.map(option => (
          <Radio.Button
            key={`graph-boolean-option--${option.title}-active`}
            id={`graph-boolean-option--${option.title}-active`}
            value={option.value}
            active={option.active}
            onClick={option.onClick}
            titleText={option.titleText}
          >
            {option.title}
          </Radio.Button>
        ))}
      </Radio>
    </div>
  )
}

export default GraphOptionsToggleBtn
