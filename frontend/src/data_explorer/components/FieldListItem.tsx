import React, {PureComponent, MouseEvent} from 'react'
import classnames from 'classnames'
import _ from 'lodash'

import FunctionSelector from 'src/shared/components/FunctionSelector'
import {ErrorHandling} from 'src/shared/decorators/errors'

import {
  ApplyFuncsToFieldArgs,
  Field,
  FieldFunc,
  FuncArg,
  SubFunction,
} from 'src/types'

interface Props {
  fieldName: string
  fieldFuncs: FieldFunc[]
  isSelected: boolean
  onToggleField: (field: Field) => void
  onApplyFuncsToField: (args: ApplyFuncsToFieldArgs) => void
  isKapacitorRule: boolean
  funcs: string[]
  isDisabled: boolean
}

interface State {
  isOpen: boolean
  isActive: boolean
}

@ErrorHandling
class FieldListItem extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      isOpen: false,
      isActive: false,
    }
  }

  public render() {
    const {
      isKapacitorRule,
      isSelected,
      fieldName,
      funcs,
      isDisabled,
    } = this.props
    const {isOpen} = this.state

    let fieldFuncsLabel
    const num = funcs.length
    switch (num) {
      case 0:
        fieldFuncsLabel = '0 Functions'
        break
      case 1:
        fieldFuncsLabel = `${num} Function`
        break
      default:
        fieldFuncsLabel = `${num} Functions`
        break
    }
    return (
      <div>
        <div
          className={classnames('query-builder--list-item', {
            active: isSelected,
            disabled: isDisabled,
          })}
          onClick={this.handleToggleField}
          onMouseEnter={this.handleHover}
          onMouseLeave={this.handleStopHover}
          data-test={`query-builder-list-item-field-${fieldName}`}
        >
          <span>
            <div className="query-builder--checkbox" />
            {fieldName} {this.helperText}
          </span>

          {isSelected ? (
            <div
              className={classnames('btn btn-xs', {
                active: isOpen,
                'btn-default': !num,
                'btn-primary': num,
                disabled: isDisabled,
              })}
              onClick={this.toggleFunctionsMenu}
              data-test={`query-builder-list-item-function-${fieldName}`}
            >
              {fieldFuncsLabel}
            </div>
          ) : null}
        </div>
        {isSelected && isOpen ? (
          <FunctionSelector
            onApply={this.handleApplyFunctions}
            selectedItems={funcs}
            singleSelect={isKapacitorRule}
          />
        ) : null}
      </div>
    )
  }

  private get helperText(): JSX.Element {
    if (this.state.isActive) {
      return (
        <dd className="query-builder--list-item--helper">
          {this.getFieldDesc()}
        </dd>
      )
    }
  }

  private toggleFunctionsMenu = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    const {isDisabled} = this.props
    if (isDisabled) {
      return
    }

    this.setState({isOpen: !this.state.isOpen})
  }

  private close = (): void => {
    this.setState({isOpen: false})
  }

  private handleHover = () => {
    this.setState({isActive: true})
  }

  private handleStopHover = () => {
    this.setState({isActive: false})
  }

  private handleToggleField = (): void => {
    const {onToggleField, fieldName} = this.props

    onToggleField({value: fieldName, type: 'field'})
    this.close()
  }

  private handleApplyFunctions = (
    selectedFuncs: string[],
    selectedSubFunc: SubFunction | null
  ) => {
    const {onApplyFuncsToField, fieldName} = this.props
    const field: Field = {value: fieldName, type: 'field'}

    onApplyFuncsToField({
      field,
      funcs: selectedFuncs.map(val => this.makeFuncArg(val, selectedSubFunc)),
      subFuns: selectedSubFunc,
    })

    this.close()
  }

  private makeFuncArg = (
    value: string,
    selectedSubFunc: SubFunction
  ): FuncArg => {
    if (!!selectedSubFunc) {
      return {
        value,
        type: 'subFunc',
      }
    }
    return {
      value,
      type: 'func',
    }
  }

  private getFieldDesc = (): string => {
    const {fieldFuncs} = this.props
    const fieldFunc = _.head(fieldFuncs)

    return _.get(fieldFunc, 'desc')
  }
}

export default FieldListItem
