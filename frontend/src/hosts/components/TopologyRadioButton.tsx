// Libraries
import React, {Component} from 'react'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  id: string
  checked: boolean
  disabled?: boolean
  name: string
  titleText: string
  text?: string
  onChange: (value: any) => void
}

@ErrorHandling
class TopologyRadioButton extends Component<Props> {
  public static defaultProps: Partial<Props> = {
    disabled: false,
    text: '',
  }

  public render() {
    const {checked, disabled, id, name, titleText, text, onChange} = this.props

    return (
      <div className="topology-preferences--radio form-control-static">
        <input
          checked={checked}
          disabled={disabled}
          id={id}
          name={name}
          title={titleText}
          type="radio"
          onChange={onChange}
        />
        <label htmlFor={id}>{text}</label>
      </div>
    )
  }
}

export default TopologyRadioButton
