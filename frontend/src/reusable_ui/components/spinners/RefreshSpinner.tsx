import React, {useEffect, useRef, useState} from 'react'

const MIN_SPIN_DURATION = 1000

interface Props {
  isActive: boolean
  isHighlighted: boolean
}

const RefreshSpinner = ({isActive, isHighlighted}: Props) => {
  const [spinning, setSpinning] = useState(false)
  const spinStartTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (isActive) {
      // 시작 시점 기록 + 스피닝 시작
      spinStartTimeRef.current = Date.now()
      setSpinning(true)
    } else if (spinning) {
      // 최소 지속시간 보장
      const elapsed = Date.now() - (spinStartTimeRef.current ?? 0)
      const remaining = MIN_SPIN_DURATION - elapsed

      if (remaining > 0) {
        const timeout = setTimeout(() => {
          setSpinning(false)
        }, remaining)
        return () => clearTimeout(timeout)
      } else {
        setSpinning(false)
      }
    }
  }, [isActive])

  return (
    <div
      className={`refresh-spinner button button-sm button-default button-square ${
        spinning ? 'spinning' : ''
      } ${isHighlighted ? 'button-primary' : ''}`}
    >
      <span className="button-icon icon refresh refresh-spinner-icon" />
    </div>
  )
}

export default RefreshSpinner
