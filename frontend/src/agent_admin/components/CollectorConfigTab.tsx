// Libraries
import React, {MouseEventHandler, PureComponent} from 'react'

// Types
import {
  CollectorConfigTabData,
  CollectorConfigTabName,
} from 'src/agent_admin/type/'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  section: CollectorConfigTabData
  focusedCollectorConfigTab: CollectorConfigTabName | ''
  handleTabClick: (selectedSection: string) => MouseEventHandler<HTMLDivElement>
}

@ErrorHandling
class CollectorConfigTab extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {section, focusedCollectorConfigTab, handleTabClick} = this.props
    const sectionName = section.name
    const capitalSectionName = sectionName.replace(/^[a-z]/, char =>
      char.toUpperCase()
    )

    return (
      <div
        className={`subsection--tab ${
          sectionName === focusedCollectorConfigTab ? 'active' : ''
        }`}
        onClick={handleTabClick(sectionName)}
      >
        {capitalSectionName}
      </div>
    )
  }
}

export default CollectorConfigTab
