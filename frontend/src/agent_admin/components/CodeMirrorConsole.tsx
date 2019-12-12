import React, {PureComponent} from 'react'
import {Controlled as ReactCodeMirror} from 'react-codemirror2'

interface Props {
  res: string
}

class CodeMirrorConsole extends PureComponent<Props> {
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
      mode: 'logger',
      theme: 'logger',
    }

    return (
      <div className="console-zone">
        <ReactCodeMirror
          autoFocus={true}
          autoCursor={true}
          value={this.props.res}
          options={options}
          onBeforeChange={(): void => {}}
          onChange={(): void => {}}
          onTouchStart={(): void => {}}
        />
      </div>
    )
  }
}

export default CodeMirrorConsole
