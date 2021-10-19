import React, {PureComponent} from 'react'
import {Rnd} from 'react-rnd'
import {Controlled as ReactCodeMirror} from 'react-codemirror2'
import PageSpinner from 'src/shared/components/PageSpinner'
import _ from 'lodash'

interface Props {
  isVisible: boolean
  onClose: () => void
  plugin: string
  description: string
}

interface State {}

class AgentConfigPlugInModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
  }

  render() {
    const options = {
      tabIndex: 1,
      readonly: true,
      lineNumbers: false,
      autoRefresh: true,
      indentUnit: 2,
      smartIndent: false,
      electricChars: false,
      completeSingle: false,
      gutters: ['error-gutter'],
      lineWrapping: true,
      mode: 'agentConf',
      theme: 'agent-conf',
    }
    const {isVisible, plugin, description} = this.props
    console.log('isVisible', isVisible)
    return (
      <div
        className={`agent-plugin`}
        style={{display: isVisible ? 'block' : 'none'}}
      >
        <Rnd
          className={`overlay--body`}
          default={{
            x: 5,
            y: 70,
            width: 450,
            height: 300,
          }}
        >
          <div className={`shell-container`}>
            <div className={`page-header`}>
              <div className={`page-header--container`}>
                <div className={`page-header--left`}>
                  <div className={`page-header--title`}>PlugIn({plugin})</div>
                </div>
                <div className={`page-header--right`}>
                  <button
                    className={`button button-sm button-default button-square icon remove`}
                    onClick={this.props.onClose}
                  />
                </div>
              </div>
            </div>
            <div
              className={`container-fluid full-height`}
              onMouseDown={e => {
                e.stopPropagation()
              }}
            >
              {_.isEmpty(description) ? (
                <div className={'loading-box'}>
                  <PageSpinner />
                </div>
              ) : null}
              <ReactCodeMirror
                autoCursor={false}
                value={description}
                options={options}
                onBeforeChange={() => false}
                onChange={() => false}
                onTouchStart={() => false}
              />
            </div>
          </div>
        </Rnd>
      </div>
    )
  }
}

export default AgentConfigPlugInModal
