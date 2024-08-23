import React from 'react'
import PropTypes from 'prop-types'

const HandlerEmpty = ({onGoToConfig, validationError, emptyJSXElement}) => (
  <div className="endpoint-tab-contents">
    <div className="endpoint-tab--parameters">
      <div className="endpoint-tab--parameters--empty">
        <p>This handler is not enabled</p>
        {emptyJSXElement ? (
          emptyJSXElement
        ) : (
          <div className="form-group form-group-submit col-xs-12 text-center">
            <button
              className="btn btn-primary"
              type="submit"
              onClick={onGoToConfig}
            >
              {validationError
                ? 'Exit Rule and Configure this Alert Handler'
                : 'Save Rule and Configure this Alert Handler'}
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)

const {string, func, element} = PropTypes

HandlerEmpty.propTypes = {
  onGoToConfig: func.isRequired,
  validationError: string.isRequired,
  emptyJSXElement: element,
}

export default HandlerEmpty
