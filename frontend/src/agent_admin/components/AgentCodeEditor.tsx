import React from 'react'
import {Controlled as ReactCodeMirror, IInstance} from 'react-codemirror2'
import {EditorChange} from 'codemirror'

interface Props {
  script: string
}

interface State {
  script: string
}

class AgentCodeEditor extends React.PureComponent<State, Props> {
  constructor(props) {
    super(props)

    this.state = {
      script: props.script,
    }
  }

  componentWillReceiveProps(newProps) {
    if (newProps.script != this.state.script) {
      this.setState({script: newProps.script})
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
      />
    )
  }

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
    this.props.onChangeScript(script)
  }
}

export default AgentCodeEditor
