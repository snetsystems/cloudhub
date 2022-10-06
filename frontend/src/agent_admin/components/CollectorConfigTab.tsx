// Libraries
import React, {MouseEventHandler, PureComponent} from 'react'

// Types
import {PageSection} from 'src/types/shared'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  section: Pick<PageSection, 'name' | 'component'>
  activeSection: string
  handleTabClick: (selectedSection: string) => MouseEventHandler<HTMLDivElement>
}

@ErrorHandling
class CollectorConfigTab extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {section, activeSection, handleTabClick} = this.props
    const sectionName = section.name.toLowerCase()

    return (
      <div
        className={`subsection--tab ${
          sectionName === activeSection ? 'active' : ''
        }`}
        onClick={handleTabClick(sectionName)}
      >
        {section.name}
      </div>
    )
  }
}

export default CollectorConfigTab
