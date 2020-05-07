// Libraries
import React, {PureComponent} from 'react'
import {Controlled as ReactCodeMirror, IInstance} from 'react-codemirror2'
import {EditorChange} from 'codemirror'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  configScript: string
  onBeforeChangeScript: (_: IInstance, __: EditorChange, ___: string) => void
  onChangeScript: (_: IInstance, __: EditorChange, ___: string) => void
}

interface State {
  script: string
}

@ErrorHandling
class AgentCodeEditor extends PureComponent<Props, State> {
  public static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    return {...prevState, script: nextProps.configScript}
  }

  public state = {
    script: '',
  }

  public render() {
    const {onBeforeChangeScript, onChangeScript} = this.props
    const options = {
      tabIndex: 1,
      readonly: false,
      lineNumbers: true,
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

    return (
      <ReactCodeMirror
        autoFocus={true}
        autoCursor={true}
        value={this.state.script}
        options={options}
        onBeforeChange={onBeforeChangeScript}
        onChange={onChangeScript}
        onTouchStart={this.onTouchStart}
      />
    )
  }

  private onTouchStart = (): void => {}
}

export default AgentCodeEditor
