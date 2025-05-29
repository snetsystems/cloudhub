import React, {useCallback, useEffect, useState} from 'react'
import {WindowResizeEventTrigger} from '../utils/trigger'
import _ from 'lodash'
import {connect} from 'react-redux'
import {closePanel} from '../actions/sidePanel'
import {bindActionCreators} from 'redux'

interface Props {
  children: React.ReactNode
  isOpen?: boolean
  panelProps?: React.ReactNode
  width?: number
  closePanel?: () => void
}

function SidePanelSlice({
  children,
  isOpen,
  panelProps,
  closePanel,
  width,
}: Props) {
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isRender, setIsRender] = useState(isOpen)

  const ANIMATION_DURATION = 320
  const LOADING_DURATION = 50

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      //delay for ready to render 0.05s
      const timer = setTimeout(() => {
        setIsRender(true)
      }, LOADING_DURATION)
      return () => clearTimeout(timer)
    } else {
      //delay for unmount 0.3s(animation duration)
      const timer = setTimeout(() => {
        setIsRender(false)
        setShouldRender(false)
      }, ANIMATION_DURATION)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // the extra 20 ms buffer ensures this runs after the animation completes(300ms).
  const debouncedFit = useCallback(
    _.debounce(WindowResizeEventTrigger, ANIMATION_DURATION),
    []
  )

  useEffect(() => {
    debouncedFit()
  }, [isOpen, debouncedFit])

  return (
    <div className={`modal-wrapper ${isOpen ? 'open' : ''}`}>
      {children}
      {shouldRender ? (
        <div
          className={`modal-content ${isOpen && isRender ? 'open' : ''}`}
          onClick={closePanel}
          style={{width: isOpen && isRender ? width : 0}}
        >
          {panelProps}
        </div>
      ) : null}
    </div>
  )
}

const mstp = ({sidePanel: {isOpen, panelProps, width}}) => {
  return {
    isOpen,
    panelProps,
    width,
  }
}

const mdtp = dispatch => {
  return {
    closePanel: bindActionCreators(closePanel, dispatch),
  }
}

export default connect(mstp, mdtp, null)(SidePanelSlice)
