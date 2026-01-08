import React, {PureComponent} from 'react'
import Authorized, {EDITOR_ROLE} from 'src/auth/Authorized'
import {BaseElasticSearchData, ToggleEsWizard} from 'src/types/elasticSearch'

interface Props {
  esSource: BaseElasticSearchData
  toggleEsWizard: ToggleEsWizard
  connectedEsSource: BaseElasticSearchData
}

class EsConnectionLink extends PureComponent<Props> {
  public render() {
    const {esSource, toggleEsWizard} = this.props
    return (
      <h5 className="margin-zero">
        <Authorized
          requiredRole={EDITOR_ROLE}
          replaceWithIfNotAuthorized={<strong>{esSource.name}</strong>}
        >
          <span
            onClick={toggleEsWizard(true, esSource)}
            className={`connection-title ${this.className}`}
          >
            <strong>{esSource.name}</strong>
            {this.default}
          </span>
        </Authorized>
      </h5>
    )
  }

  private get className(): string {
    if (this.isCurrentEsInfo) {
      return 'link-success'
    }

    return ''
  }

  private get default(): string {
    const {esSource} = this.props
    if (esSource.default) {
      return ' (Default)'
    }

    return ''
  }

  private get isCurrentEsInfo(): boolean {
    const {esSource, connectedEsSource} = this.props
    return esSource?.id === connectedEsSource?.id
  }
}

export default EsConnectionLink
