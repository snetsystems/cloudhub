import React, {
  ReactElement,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from 'react'
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import _ from 'lodash'
import {connect} from 'react-redux'
import {closePanel} from 'src/shared/actions/sidePanel'
import {bindActionCreators} from 'redux'
import {HANDLE_HORIZONTAL, HANDLE_VERTICAL} from 'src/shared/constants'
import Threesizer from './threesizer/Threesizer'

interface Props {
  children: React.ReactNode
  isOpen?: boolean
  panelProps?: React.ReactNode
  width?: number
  closePanel?: () => void
}

function SidePanelSlice({children, isOpen, panelProps}: Props) {
  const [isRender, setIsRender] = useState(isOpen)
  const [verticalProportions, setVerticalProportions] = useState([1, 0])

  const ANIMATION_DURATION = 320
  const LOADING_DURATION = 100

  useEffect(() => {
    // animation for open and close
    if (isOpen) {
      const timer = setTimeout(() => {
        setIsRender(true)
      }, LOADING_DURATION)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => {
        setIsRender(false)
      }, ANIMATION_DURATION)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const debouncedFit = useCallback(
    _.debounce(WindowResizeEventTrigger, ANIMATION_DURATION),
    []
  )

  useEffect(() => {
    if (isOpen) {
      setVerticalProportions([0.65, 0.35])
    } else {
      setVerticalProportions([1, 0])
    }
  }, [isOpen])

  useEffect(() => {
    debouncedFit()
  }, [isOpen, debouncedFit, verticalProportions])

  const verticalHandleResize = (verticalProportions: number[]): void => {
    setVerticalProportions(verticalProportions)
  }

  const renderLeftSection = useCallback(() => {
    return children as ReactElement<any>
  }, [children])

  const renderRightSection = useCallback(() => {
    return isRender ? (panelProps as ReactElement<any>) : null
  }, [isRender, panelProps])

  const verticalDivisions = useMemo(() => {
    const [leftSize, rightSize] = verticalProportions
    return [
      {
        name: '',
        handleDisplay: 'none',
        headerButtons: [],
        menuOptions: [],
        style: {
          minWidth: '500px',
        },
        render: renderLeftSection,
        headerOrientation: HANDLE_HORIZONTAL,
        size: leftSize,
      },
      {
        name: '',
        handlePixels: 8,
        handleDisplay: 'default',
        headerButtons: [],
        menuOptions: [],
        render: renderRightSection,
        headerOrientation: HANDLE_HORIZONTAL,
        size: rightSize,
      },
    ]
  }, [verticalProportions, renderLeftSection, renderRightSection])

  return (
    <div style={{width: '100%', height: '100%'}}>
      <Threesizer
        orientation={HANDLE_VERTICAL}
        divisions={verticalDivisions}
        onResize={verticalHandleResize}
      />
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
