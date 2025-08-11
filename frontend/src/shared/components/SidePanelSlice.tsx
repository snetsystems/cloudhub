// Library
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from 'react'
import _ from 'lodash'

// Actions
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {closePanel} from 'src/shared/actions/sidePanel'

// Redux
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux'

// Components
import {HANDLE_HORIZONTAL, HANDLE_VERTICAL} from 'src/shared/constants'
import Threesizer from 'src/shared/components/threesizer/Threesizer'

interface Props {
  children: React.ReactNode
  isOpen?: boolean
  panelProps?: React.ReactNode
  width?: number
  closePanel?: () => void
  localStorageKey?: string
}

function SidePanelSlice({
  children,
  isOpen,
  panelProps,
  localStorageKey,
}: Props) {
  const [isRender, setIsRender] = useState(false)
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
      setVerticalProportions(loadVerticalProportions())
    } else {
      setVerticalProportions([1, 0])
    }
  }, [isOpen])

  useEffect(() => {
    debouncedFit()
  }, [isOpen, debouncedFit, verticalProportions])

  const verticalHandleResize = (verticalProportions: number[]): void => {
    if (!isRender) {
      setVerticalProportions([1, 0])
    } else {
      setVerticalProportions(verticalProportions)
      saveVerticalProportions(verticalProportions)
    }
  }

  const renderLeftSection = useCallback(() => {
    return children as ReactElement<any>
  }, [children])

  const renderRightSection = useCallback(() => {
    return isRender && verticalProportions[1] > 0.05
      ? (panelProps as ReactElement<any>)
      : null
  }, [isRender, panelProps, verticalProportions])

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
  }, [isRender, verticalProportions, renderLeftSection, renderRightSection])

  const saveVerticalProportions = (verticalProportions: number[]): void => {
    if (!localStorageKey) {
      return
    }
    const store = localStorage.getItem(localStorageKey)
    const parsed = store ? JSON.parse(store) : {}
    localStorage.setItem(
      localStorageKey,
      JSON.stringify({
        ...parsed,
        verticalProportions,
      })
    )
  }

  const loadVerticalProportions = (): number[] => {
    if (!localStorageKey) {
      return [0.65, 0.35]
    }
    const savedStore = localStorage.getItem(localStorageKey)
    const parsed = savedStore
      ? JSON.parse(savedStore).verticalProportions
      : [0.65, 0.35]

    if (_.isEqual(parsed, [1, 0])) {
      return [0.65, 0.35]
    }
    return parsed
  }

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
