import React from 'react'
import {ComponentSize, SlideToggle} from 'src/reusable_ui'

interface Props {
  label: string
  isActive: boolean
  onChange: () => void
  isLeft?: boolean
  isHide?: boolean
}

const PredictionHexbinToggle = ({
  label,
  isActive,
  onChange,
  isLeft = false,
  isHide,
}: Props) => {
  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{zIndex: 3}}
      className={`prediction ${
        isLeft ? 'page-header--left' : 'page-header--right'
      } ${isHide ? 'dev-mode' : ''}`}
    >
      <div className={`${isLeft ? 'page-header--left' : 'page-header--right'}`}>
        <label className="hexbin-header--label">{label}</label>
        <SlideToggle
          active={isActive}
          onChange={onChange}
          size={ComponentSize.ExtraSmall}
        />
      </div>
    </div>
  )
}

export default PredictionHexbinToggle
