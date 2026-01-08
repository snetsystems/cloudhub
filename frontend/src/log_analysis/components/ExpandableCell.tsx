// Libraries
import React, {useState} from 'react'

// Types
interface ExpandableCellProps {
  text: string
  width: string
  collapsedHeight?: string
  expandedMaxHeight?: string
  linkColor?: string
}

const ExpandableCell: React.FC<ExpandableCellProps> = ({
  text,
  width,
  collapsedHeight = '1.2em',
  expandedMaxHeight = '120px',
  linkColor = '#0079a5',
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentClass = `expandableCell__content ${
    isExpanded ? 'expanded' : 'collapsed'
  }`

  return (
    <div className="expandableCell" style={{width}}>
      <div
        className={contentClass}
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? undefined : text}
        style={{maxHeight: isExpanded ? expandedMaxHeight : collapsedHeight}}
      >
        {text}
      </div>
      <span
        className="expandableCell__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{color: linkColor}}
      ></span>
    </div>
  )
}

export default ExpandableCell
