import React, {PureComponent} from 'react'
import {Controlled as ReactCodeMirror, IInstance} from 'react-codemirror2'
import {Editor} from 'codemirror'

interface Props {
  res: string
}

interface ReactCodeMirrorEditor extends IInstance {
  editor: Editor
  doc: {height: number}
}

class CodeMirrorConsole extends PureComponent<Props, ReactCodeMirrorEditor> {
  constructor(props: Props) {
    super(props)
  }

  handleDidChange = (editor: ReactCodeMirrorEditor) => {
    editor.scrollTo(0, editor.doc.height)
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
          onTouchStart={(): void => {}}
          onChange={(editor: ReactCodeMirrorEditor) => {
            this.handleDidChange(editor)
          }}
        />
      </div>
    )
  }
}

export default CodeMirrorConsole
