import React, {Component, ReactNode} from 'react'
import uuid from 'uuid'
import {withRouter, InjectedRouter} from 'react-router'

import SubSectionsTab from 'src/shared/components/SubSectionsTab'
import {ErrorHandling} from 'src/shared/decorators/errors'
import {PageSection} from 'src/types/shared'

interface Props {
  sections: PageSection[]
  activeSection: string
  sourceID: string
  router: InjectedRouter
  parentUrl: string
}

@ErrorHandling
class SubSections extends Component<Props> {
  constructor(props) {
    super(props)
  }

  public render() {
    const {sections, activeSection} = this.props

    return (
      <div className="row subsection">
        <div className="col-md-2 subsection--nav" data-test="subsectionNav">
          <div className="subsection--tabs">
            {sections.map(
              section =>
                section.enabled && (
                  <SubSectionsTab
                    key={uuid.v4()}
                    section={section}
                    handleClick={this.handleTabClick(section.url)}
                    activeSection={activeSection}
                  />
                )
            )}
          </div>
        </div>
        <div
          className="col-md-10 subsection--content"
          data-test="subsectionContent"
        >
          {this.activeSectionComponent}
        </div>
      </div>
    )
  }

  private get activeSectionComponent(): ReactNode {
    const {sections, activeSection} = this.props
    const active = sections.find(
      section => section && section.url === activeSection
    )
    if (active) {
      return active.component
    }

    const fallback = sections.find(section => section && section.enabled)
    return fallback ? fallback.component : null
  }

  public componentDidMount() {
    this.redirectIfSectionMissing()
  }

  public componentDidUpdate(prevProps: Props) {
    if (
      prevProps.activeSection !== this.props.activeSection ||
      prevProps.sections !== this.props.sections
    ) {
      this.redirectIfSectionMissing()
    }
  }

  private redirectIfSectionMissing = () => {
    const {sections, activeSection, router, sourceID, parentUrl} = this.props
    const active = sections.find(
      section => section && section.url === activeSection
    )
    if (active && active.enabled) {
      return
    }

    const fallback = sections.find(section => section && section.enabled)
    if (!fallback || fallback.url === activeSection) {
      return
    }

    router.replace(`/sources/${sourceID}/${parentUrl}/${fallback.url}`)
  }

  public handleTabClick = url => () => {
    const {router, sourceID, parentUrl} = this.props
    router.push(`/sources/${sourceID}/${parentUrl}/${url}`)
  }
}

export default withRouter(SubSections)
