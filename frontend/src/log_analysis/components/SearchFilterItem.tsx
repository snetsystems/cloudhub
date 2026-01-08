// Libraries
import React from 'react'
import {OuiIcon} from '@opensearch-project/oui'

// Components
import 'src/log_analysis/util/setupOUIIcons'

// Types
export interface SearchFilterItemProps {
  iconType: string
  label: React.ReactNode
  description?: React.ReactNode
  itemProps: React.HTMLAttributes<HTMLDivElement>
}

function SearchFilterItem({
  iconType,
  label,
  description,
  itemProps,
}: SearchFilterItemProps) {
  return (
    <div {...itemProps} className={`kql-item ${itemProps.className ?? ''}`}>
      <div>
        <OuiIcon type={iconType} className="kql-token" />
      </div>
      <span className="kql-label">{label}</span>
      {description && <span className="kql-desc">{description}</span>}
    </div>
  )
}

export default SearchFilterItem
