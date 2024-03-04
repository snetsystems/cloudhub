import React, {PureComponent, MouseEvent} from 'react'
import classnames from 'classnames'
import _ from 'lodash'
import {
  INFLUXQL_DERIVATIVE,
  INFLUXQL_FUNCTIONS,
  INFLUXQL_NESTED_FUNCTIONS,
} from 'src/data_explorer/constants'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {SubFunction} from 'src/types'

interface Props {
  onApply: (item: string[], subItem: SubFunction | null) => void
  selectedItems: string[]
  singleSelect: boolean
}

interface State {
  localSelectedItems: string[]
  localSelectedSubItems: SubFunction | null
  isMouseOver: boolean
  mouseNum: number | null
}

@ErrorHandling
class FunctionSelector extends PureComponent<Props, State> {
  constructor(props) {
    super(props)

    this.state = {
      localSelectedItems: this.props.selectedItems,
      localSelectedSubItems: null,
      isMouseOver: false,
      mouseNum: null,
    }
  }

  public UNSAFE_componentWillUpdate(nextProps) {
    if (!_.isEqual(this.props.selectedItems, nextProps.selectedItems)) {
      this.setState({localSelectedItems: nextProps.selectedItems})
    }
  }

  public render() {
    const {singleSelect} = this.props

    return (
      <div className="function-selector">
        {!singleSelect && (
          <div className="function-selector--header">
            <span>{this.headerText}</span>
            <div
              className="btn btn-xs btn-success"
              onClick={this.handleApplyFunctions}
              data-test="function-selector-apply"
            >
              Apply
            </div>
          </div>
        )}
        <div className="function-selector--grid">
          {INFLUXQL_FUNCTIONS.map((f, i) => {
            return (
              <React.Fragment key={i}>
                <div
                  key={i}
                  onMouseOver={() => {
                    if (this.isSelected(f)) {
                      this.setState({isMouseOver: true})
                    }
                    this.setState({mouseNum: i})
                  }}
                  onMouseLeave={() => {
                    this.setState({isMouseOver: false})
                    this.setState({mouseNum: null})
                  }}
                  className={classnames('function-selector--item', {
                    active: this.isSelected(f),
                  })}
                  onClick={_.wrap(
                    f,
                    singleSelect ? this.onSingleSelect : this.onSelect
                  )}
                  data-test={`function-selector-item-${f}`}
                >
                  <div>{f}</div>

                  {this.state.isMouseOver && i === this.state.mouseNum && (
                    <div
                      className={classnames(`function-selector--subitem`, {
                        hidden: !this.isSelected(f),
                        left: i % 4 !== 3,
                        right: i % 4 === 3,
                      })}
                    >
                      {INFLUXQL_NESTED_FUNCTIONS.map((subf, idx) => {
                        return (
                          <div
                            onClick={e => {
                              e.stopPropagation()
                              this.onSubFuncSelect(f, subf)
                            }}
                            onMouseOver={() => {}}
                            key={idx}
                            className={classnames(`function-selector--item`, {
                              active: this.isSubFuncSelected(f, subf),
                            })}
                          >
                            {subf}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                {this.state.localSelectedItems.length > 0 && (
                  <div
                    key={f}
                    className={`${
                      i === this.expandLineNum(this.state.mouseNum)
                        ? 'function-selector--extraline'
                        : 'function-selector--hide'
                    }`}
                  />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    )
  }

  private get headerText(): string {
    const numItems = this.state.localSelectedItems.length
    if (!numItems) {
      return 'Select functions below'
    }

    return `${numItems} Selected`
  }

  private onSelect = (item: string, e: MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation()

    this.onClickMouseEvent(item)

    const {localSelectedItems} = this.state

    let nextItems

    if (item === INFLUXQL_DERIVATIVE) {
      nextItems =
        localSelectedItems.filter(i => i === item).length > 0 ? [] : [item]
      this.onDerivativeClick()
    } else if (this.isSelected(item)) {
      nextItems = localSelectedItems?.filter(i => i !== item)
      this.onOneSubFuncDelete(item, '*')
    } else if (
      this.isSelected(INFLUXQL_DERIVATIVE) &&
      item !== INFLUXQL_DERIVATIVE
    ) {
      nextItems = [item]
      this.onDerivativeClick()
    } else {
      nextItems = [...localSelectedItems, item]
    }

    this.setState({localSelectedItems: nextItems})
  }

  private onSingleSelect = (item: string): void => {
    this.onClickMouseEvent(item)

    if (item === this.state.localSelectedItems[0]) {
      this.props.onApply([], null)
      this.setState({localSelectedItems: []})
    } else {
      this.props.onApply([item], null)
      this.setState({localSelectedItems: [item]})
    }
  }

  private onSubFuncSelect = (item: string, subItem: string): void => {
    const subFunc = this.state.localSelectedSubItems

    if (subFunc === null) {
      const tempObj = {}
      tempObj[item] = [subItem]
      this.setState({localSelectedSubItems: tempObj})
    } else {
      if (!!subFunc[item]) {
        if (this.isSubFuncSelected(item, subItem)) {
          this.onOneSubFuncDelete(item, subItem)
        } else {
          // func O, subfunc x
          const tempObj: SubFunction = subFunc
          tempObj[item] = [...tempObj[item], subItem]

          this.setState({
            localSelectedSubItems: {...tempObj},
          })
        }
      } else {
        // subfunc x
        const tempObj: SubFunction = subFunc
        tempObj[item] = [subItem]
        this.setState({localSelectedSubItems: {...tempObj}})
      }
    }
  }

  private onOneSubFuncDelete = (item: string, subItem: string) => {
    const subFunc = this.state.localSelectedSubItems
    const tempObj: SubFunction = subFunc

    if (!subFunc?.[item]) {
      return
    }
    tempObj[item] = subFunc[item]?.filter(
      target => target !== subItem && subItem !== '*'
    )
    if (tempObj[item]?.length === 0) {
      const keyAry = Object.keys(tempObj)
      const temp: SubFunction = {}
      keyAry.forEach(element => {
        if (element !== item) {
          temp[element] = tempObj[element]
        }
      })
      this.setState({
        localSelectedSubItems: temp,
      })
    } else {
      this.setState({
        localSelectedSubItems: {...tempObj},
      })
    }
  }

  private onDerivativeClick = () => {
    this.setState({localSelectedSubItems: null})
  }

  // When you click func btn, subfunc window hover make open
  private onClickMouseEvent = (item: string) => {
    if (!this.isSelected(item)) {
      this.setState({isMouseOver: true})
    } else {
      this.setState({isMouseOver: false})
    }
  }

  private isSelected = (item: string): boolean => {
    return !!this.state.localSelectedItems.find(text => text === item)
  }

  private isSubFuncSelected = (item: string, subItem: string): boolean => {
    if (
      this.state.localSelectedSubItems !== null &&
      !!this.state.localSelectedSubItems[item]
    ) {
      return !!this.state.localSelectedSubItems[item].find(
        text => text === subItem
      )
    }
    return false
  }

  private handleApplyFunctions = (e: MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation()
    this.props.onApply(
      this.state.localSelectedItems,
      this.state.localSelectedSubItems
    )
  }

  // Calculate index that mouse over for make another line
  private expandLineNum = (idx: number | null) => {
    if (this.state.isMouseOver && idx !== null) {
      if (Math.floor(idx / 4) * 4 + 3 >= INFLUXQL_FUNCTIONS.length) {
        return INFLUXQL_FUNCTIONS.length - 1
      }
      return Math.floor(idx / 4) * 4 + 3
    }
  }
}

export default FunctionSelector
