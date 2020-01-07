// Libraries
import React, {PureComponent} from 'react'
import {Controlled as ReactCodeMirror, IInstance} from 'react-codemirror2'
import {EditorChange} from 'codemirror'

interface Props {
  configScript: string
  onChangeScript: (script: string) => void
}

interface State {
  script: string
}

class AgentCodeEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      script: props.configScript,
    }
  }

  public componentWillReceiveProps(newProps: Props) {
    if (this.state.script !== newProps.configScript) {
      this.setState({script: newProps.configScript})
    }
  }

  public render() {
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
        onBeforeChange={this.beforeChange}
        onChange={this.updateChange}
        onTouchStart={this.onTouchStart}
      />
    )
  }
  private onTouchStart = (): void => {}

  private beforeChange = (
    ___: IInstance,
    ____: EditorChange,
    script: string
  ) => {
    return this.setState({script})
  }

  private updateChange = (
    ___: IInstance,
    ____: EditorChange,
    script: string
  ) => {
    const {onChangeScript} = this.props
    return onChangeScript(script)
  }
}

export default AgentCodeEditor
