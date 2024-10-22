import React, {Component} from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import moment from 'moment'
import {connect} from 'react-redux'
import _ from 'lodash'

import OnClickOutside from 'shared/components/OnClickOutside'
import FancyScrollbar from 'shared/components/FancyScrollbar'
import CustomTimeRangeOverlay from 'shared/components/CustomTimeRangeOverlay'

import {timeRanges} from 'shared/data/timeRanges'
import {DROPDOWN_MENU_MAX_HEIGHT} from 'shared/constants/index'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {TimeZones} from 'src/types'

const dateFormat = 'YYYY-MM-DD HH:mm'
const emptyTime = {lower: '', upper: ''}
const format = (t, timeZone) => {
  const m = moment(t.replace(/'/g, ''))
  if (timeZone === TimeZones.UTC) {
    m.utc()
  }
  return m.format(dateFormat)
}

class TimeRangeShiftDropdown extends Component {
  constructor(props) {
    super(props)
    const {lower, upper} = props.selected

    const isTimeValid = moment(upper).isValid() && moment(lower).isValid()
    const customTimeRange = isTimeValid ? {lower, upper} : emptyTime

    this.state = {
      autobind: false,
      isOpen: false,
      isCustomTimeRangeOpen: false,
      customTimeRange,
    }
  }

  findTimeRangeInputValue = ({upper, lower}) => {
    if (upper && lower) {
      if (upper === 'now()') {
        return `${format(lower, this.props.timeZone)} - Now`
      }

      return `${format(lower, this.props.timeZone)} - ${format(
        upper,
        this.props.timeZone
      )}`
    }

    const selected = timeRanges.find(range => range.lower === lower)
    return selected ? selected.inputValue : 'Custom'
  }

  handleClickOutside = () => {
    this.setState({isOpen: false})
  }

  handleSelection = timeRange => () => {
    this.setState({customTimeRange: emptyTime, isOpen: false}, () => {
      window.setTimeout(() => {
        this.props.onChooseTimeRange(timeRange)
      }, 0)
    })
  }

  toggleMenu = () => {
    this.setState({isOpen: !this.state.isOpen})
  }

  showCustomTimeRange = () => {
    this.setState({isCustomTimeRangeOpen: true})
  }

  handleApplyCustomTimeRange = customTimeRange => {
    this.props.onChooseTimeRange({...customTimeRange})
    this.setState({customTimeRange, isOpen: false})
  }

  handleShiftToPreviousTime = () => {
    const {lower, upper} = this.props.selected

    let newLower = ''
    let newUpper = upper

    if (upper === null) {
      if (lower && lower.includes('now() -')) {
        const amount = lower.match(/now\(\) - (\d+)([smhd])/)

        if (amount) {
          const value = parseInt(amount[1], 10)
          const unit = amount[2]
          const now = moment()

          if (unit === 'm') {
            newUpper = now.subtract(value, 'minutes').toISOString()
            newLower = now.subtract(value, 'minutes').toISOString()
          } else if (unit === 'h') {
            newUpper = now.subtract(value, 'hours').toISOString()
            newLower = now.subtract(value, 'hours').toISOString()
          } else if (unit === 'd') {
            newUpper = now.subtract(value, 'days').toISOString()
            newLower = now.subtract(value, 'days').toISOString()
          } else {
            newUpper = null
            newLower = 'now() - 1h'
          }
        } else {
          newUpper = null
          newLower = 'now() - 1h'
        }
      } else {
        newUpper = null
        newLower = 'now() - 1h'
      }
    } else if (upper === 'now()' && moment(lower).isValid()) {
      const now = moment()
      const duration = moment.duration(moment().diff(moment(lower)))

      newUpper = now.subtract(duration).toISOString()
      newLower = moment(lower).subtract(duration).toISOString()
    } else if (moment(upper).isValid() && moment(lower).isValid()) {
      const duration = moment.duration(moment(upper).diff(moment(lower)))

      newUpper = moment(upper).subtract(duration).toISOString()
      newLower = moment(lower).subtract(duration).toISOString()
    } else {
      newUpper = null
      newLower = 'now() - 1h'
    }

    this.props.onChooseTimeRange({lower: newLower, upper: newUpper})
    this.setState({
      customTimeRange: {lower: newLower, upper: newUpper},
      isOpen: false,
    })
  }

  handleShiftToNextTime = () => {
    const {lower, upper} = this.props.selected

    let newLower = ''
    let newUpper = upper

    if (upper === null) {
      if (lower && lower.includes('now() -')) {
        const amount = lower.match(/now\(\) - (\d+)([smhd])/)

        if (amount) {
          const value = parseInt(amount[1], 10)
          const unit = amount[2]
          const now = moment()

          if (unit === 'm') {
            newLower = now.toISOString()
            newUpper = now.add(value, 'minutes').toISOString()
          } else if (unit === 'h') {
            newLower = now.toISOString()
            newUpper = now.add(value, 'hours').toISOString()
          } else if (unit === 'd') {
            newLower = now.toISOString()
            newUpper = now.add(value, 'days').toISOString()
          } else {
            newLower = 'now() - 1h'
            newUpper = null
          }
        } else {
          newLower = 'now() - 1h'
          newUpper = null
        }
      } else {
        newLower = 'now() - 1h'
        newUpper = null
      }
    } else if (upper === 'now()' && moment(lower).isValid()) {
      const now = moment()
      const duration = moment.duration(moment().diff(moment(lower)))

      newLower = moment(lower).add(duration).toISOString()
      newUpper = now.add(duration).toISOString()
    } else if (moment(upper).isValid() && moment(lower).isValid()) {
      const duration = moment.duration(moment(upper).diff(moment(lower)))

      newLower = moment(lower).add(duration).toISOString()
      newUpper = moment(upper).add(duration).toISOString()
    } else {
      newLower = 'now() - 1h'
      newUpper = null
    }

    this.props.onChooseTimeRange({lower: newLower, upper: newUpper})
    this.setState({
      customTimeRange: {lower: newLower, upper: newUpper},
      isOpen: false,
    })
  }

  handleToggleCustomTimeRange = () => {
    this.setState({isCustomTimeRangeOpen: !this.state.isCustomTimeRangeOpen})
  }

  handleCloseCustomTimeRange = () => {
    this.setState({isCustomTimeRangeOpen: false})
  }

  render() {
    const {selected, preventCustomTimeRange, page} = this.props
    const {isOpen, customTimeRange, isCustomTimeRangeOpen} = this.state
    const isRelativeTimeRange = selected?.upper === null
    const isNow = selected?.upper === 'now()'

    return (
      <div className="time-range-dropdown">
        <div
          className={classnames('dropdown', {
            'dropdown-120': isRelativeTimeRange,
            'dropdown-210': isNow,
            'dropdown-290': !isRelativeTimeRange && !isNow,
            open: isOpen,
          })}
        >
          <div
            className="btn btn-sm btn-default dropdown-toggle"
            onClick={this.toggleMenu}
          >
            <span className="icon clock" />
            <span className="dropdown-selected">
              {this.findTimeRangeInputValue(selected)}
            </span>
            <span className="caret" />
          </div>
          <ul className="dropdown-menu">
            <FancyScrollbar
              autoHide={false}
              autoHeight={true}
              maxHeight={DROPDOWN_MENU_MAX_HEIGHT}
            >
              {preventCustomTimeRange ? null : (
                <div>
                  <li className="dropdown-header">Absolute Time</li>
                  <li
                    className={
                      isCustomTimeRangeOpen
                        ? 'active dropdown-item custom-timerange'
                        : 'dropdown-item custom-timerange'
                    }
                  >
                    <a href="#" onClick={this.showCustomTimeRange}>
                      Date Picker
                    </a>
                  </li>
                </div>
              )}

              <div style={{display: 'flex', flexDirection: 'row'}}>
                <li
                  className="dropdown-item"
                  style={{
                    width: '50%',
                    textAlign: 'center',
                  }}
                >
                  <a href="#" onClick={this.handleShiftToPreviousTime}>
                    {'Prev'}
                  </a>
                </li>
                <li
                  className="dropdown-item"
                  style={{
                    width: '50%',
                    textAlign: 'center',
                  }}
                >
                  <a href="#" onClick={this.handleShiftToNextTime}>
                    {'Next'}
                  </a>
                </li>
              </div>
              <li className="dropdown-header">
                {preventCustomTimeRange ? '' : 'Relative '}Time
              </li>
              {timeRanges.map(item => {
                return (
                  <li className="dropdown-item" key={item.menuOption}>
                    <a href="#" onClick={this.handleSelection(item)}>
                      {item.menuOption}
                    </a>
                  </li>
                )
              })}
            </FancyScrollbar>
          </ul>
        </div>
        {isCustomTimeRangeOpen ? (
          <CustomTimeRangeOverlay
            onApplyTimeRange={this.handleApplyCustomTimeRange}
            timeRange={customTimeRange}
            isVisible={isCustomTimeRangeOpen}
            onToggle={this.handleToggleCustomTimeRange}
            onClose={this.handleCloseCustomTimeRange}
            page={page}
          />
        ) : null}
      </div>
    )
  }
}

const {bool, func, shape, string} = PropTypes

TimeRangeShiftDropdown.defaultProps = {
  page: 'default',
}

TimeRangeShiftDropdown.propTypes = {
  selected: shape({
    lower: string,
    upper: string,
  }).isRequired,
  onChooseTimeRange: func.isRequired,
  preventCustomTimeRange: bool,
  page: string,
  timeZone: string,
}

const mstp = state => ({
  timeZone: _.get(state, ['app', 'persisted', 'timeZone']),
})
export default connect(mstp)(
  OnClickOutside(ErrorHandling(TimeRangeShiftDropdown))
)
