import React, {PureComponent} from 'react'

import {
  OverlayContainer,
  OverlayHeading,
  OverlayBody,
  Form,
  Button,
} from 'src/reusable_ui'
import OverlayTechnology from 'src/reusable_ui/components/overlays/OverlayTechnology'

// Components
import CodeMirrorConsole from 'src/agent_admin/components/CodeMirrorConsole'
import AgentConfigConsoleModalDropdown from 'src/agent_admin/components/AgentConfigConsoleModalDropdown'
import PageSpinner from 'src/shared/components/PageSpinner'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Types
import {RemoteDataState, DropdownItem} from 'src/types'

interface Props {
  onClickTestCall: () => void
  onClose: () => void
  onChoose: (item: DropdownItem) => void
  onClickInputPluginsDropdown: () => void
  onCloseInputPluginsDropdown: () => void
  message: string
  cancelText: string
  visible: boolean
  headingTitle: string
  existingInputPluginList: DropdownItem[]
  inputPluginTestStatus: RemoteDataState
  isDisabledPlugins: boolean
  selectedInputPlugin: string
  isOpenPlugin: boolean
}

interface State {
  isVisible: boolean
}

@ErrorHandling
class AgentConfigConsoleModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      isVisible: false,
    }
  }

  private get loadingState() {
    const {inputPluginTestStatus} = this.props
    let isLoading = false

    if (inputPluginTestStatus === RemoteDataState.Loading) {
      isLoading = true
    }

    return isLoading ? (
      <div
        style={{
          position: 'absolute',
          zIndex: 3,
          backgroundColor: 'rgba(0,0,0,0.5)',
          width: '100%',
          height: '100%',
        }}
      >
        <PageSpinner />
      </div>
    ) : null
  }

  public render() {
    const {
      onClickTestCall,
      onChoose,
      onClose,
      onClickInputPluginsDropdown,
      onCloseInputPluginsDropdown,
      message,
      cancelText,
      visible,
      headingTitle,
      existingInputPluginList,
      isDisabledPlugins,
      selectedInputPlugin,
      isOpenPlugin,
    } = this.props

    return (
      <>
        <OverlayTechnology visible={visible}>
          <OverlayContainer>
            <div style={{position: 'relative'}}>
              {this.loadingState}
              <OverlayHeading title={headingTitle} onDismiss={onClose} />
              <OverlayBody>
                <>
                  <h2 className="panel-title use-user-select console-input-plugin">
                    Input Plugins
                  </h2>

                  <AgentConfigConsoleModalDropdown
                    items={existingInputPluginList}
                    isOpen={isOpenPlugin}
                    useAutoComplete={true}
                    disabled={isDisabledPlugins}
                    onChoose={onChoose}
                    onClick={onClickInputPluginsDropdown}
                    onClose={onCloseInputPluginsDropdown}
                    selected={selectedInputPlugin}
                    className={'dropdown'}
                  />

                  <button
                    className="button button-xs button-primary agent-dropbox--btn"
                    onClick={onClickTestCall}
                  >
                    Test
                  </button>
                </>
                <Form>
                  <Form.Element>
                    <CodeMirrorConsole res={message} />
                  </Form.Element>
                  <Form.Footer>
                    <Button text={cancelText} onClick={onClose} />
                  </Form.Footer>
                </Form>
              </OverlayBody>
            </div>
          </OverlayContainer>
        </OverlayTechnology>
      </>
    )
  }
}

export default AgentConfigConsoleModal
