// Libraries
import React, {PureComponent} from 'react'
import {Controlled as ReactCodeMirror, IInstance} from 'react-codemirror2'
import {EditorChange} from 'codemirror'

// Components
import AgentConfiguration from 'src/agent_admin/containers/AgentConfiguration'

interface Props {
  configScript: string
  onChangeScript: AgentConfiguration['onChangeScript']
}

interface State {
  script: string
}

class AgentCodeEditor extends PureComponent<Props, State> {
  constructor(props) {
    super(props)
    this.state = {
      script: props.configScript,
    }
  }

  componentWillReceiveProps(newProps) {
    if (this.state.script !== newProps.configScript) {
      this.setState({script: newProps.configScript})
    }
  }

  render() {
    const options = {
      tabIndex: 1,
      readonly: false,
      lineNumbers: true,
      autoRefresh: true,
      indentUnit: 2,
      smartIndent: false,
      electricChars: false,
      theme: 'time-machine',
      completeSingle: false,
      gutters: ['error-gutter'],
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
  private onTouchStart = () => {}

  private beforeChange = (
    ___: IInstance,
    ____: EditorChange,
    script: string
  ): void => {
    return this.setState({script})
  }

  private updateChange = (
    ___: IInstance,
    ____: EditorChange,
    script: string
  ): void => {
    const {onChangeScript} = this.props
    return onChangeScript(script)
  }
}

export default AgentCodeEditor
