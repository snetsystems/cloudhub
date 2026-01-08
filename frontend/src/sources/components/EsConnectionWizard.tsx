import React, {PureComponent} from 'react'
import _ from 'lodash'

import WizardOverlay from 'src/reusable_ui/components/wizard/WizardOverlay'
import WizardStep from 'src/reusable_ui/components/wizard/WizardStep'
import {NextReturn} from 'src/types/wizard'
import ElasticStep from './ElasticStep'
import CompletionStep from './CompletionStep'
import {withRouter, WithRouterProps} from 'react-router'
import {
  BaseElasticSearchData,
  CreateElasticSearchParams,
  ToggleEsWizard,
} from 'src/types'

interface Props {
  isVisible: boolean
  toggleEsWizard: ToggleEsWizard
  esSource?: BaseElasticSearchData | null
}

interface State {
  esSource: CreateElasticSearchParams
  sourceError: boolean
  dashboardError: boolean
}

class EsConnectionWizard extends PureComponent<Props & WithRouterProps> {
  public state: State = {
    esSource: null,
    sourceError: false,
    dashboardError: false,
  }

  public sourceStepRef: any

  componentDidMount(): void {
    const {esSource} = this.props
    if (esSource) {
      this.setState({esSource: esSource ?? null})
    }
  }

  public render() {
    const {isVisible, toggleEsWizard, esSource} = this.props
    const {sourceError} = this.state
    return (
      <WizardOverlay
        visible={isVisible}
        toggleVisibility={toggleEsWizard}
        resetWizardState={this.resetWizardState}
        title="Elasticsearch Connection Configuration"
        maxWidth={800}
      >
        <WizardStep
          title="Elasticsearch Connection"
          tipText=""
          isComplete={this.isSourceComplete}
          isErrored={sourceError}
          isSkippableStep={false}
          onNext={this.handleSourceNext}
          nextLabel={!!esSource ? 'Update Connection' : 'Add Connection'}
          previousLabel="Cancel"
        >
          <ElasticStep
            ref={c => (this.sourceStepRef = c)}
            setError={this.handleSetSourceError}
            esSource={esSource}
          />
        </WizardStep>
        <WizardStep
          title="Setup Complete"
          tipText=""
          isComplete={this.isSourceComplete}
          isSkippableStep={false}
          onNext={this.handleCompletionNext}
          nextLabel="Finish"
          previousLabel="Go Back"
        >
          <CompletionStep />
        </WizardStep>
      </WizardOverlay>
    )
  }

  // SourceStep
  private isSourceComplete = () => {
    const {esSource} = this.state
    return !_.isNull(esSource)
  }

  private handleSourceNext = async () => {
    const response: NextReturn = await this.sourceStepRef.next()
    this.setState({esSource: response.payload, sourceError: response.error})
    return response
  }

  private handleSetSourceError = (b: boolean) => {
    if (this.state.sourceError !== b) {
      this.setState({sourceError: b})
    }
  }

  private handleCompletionNext = (): NextReturn => {
    this.resetWizardState()

    return {error: false, payload: null}
  }

  private resetWizardState = () => {
    this.setState({
      esSource: null,
      sourceError: false,
      dashboardError: false,
    })
  }
}

export default withRouter(EsConnectionWizard)
