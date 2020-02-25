import React from 'react'
import {Controlled as ReactCodeMirror, IInstance} from 'react-codemirror2'
import {Editor} from 'codemirror'

interface Props {
  res: string
  handleOnChange?: (editor: ReactCodeMirrorEditor) => void
}

interface ReactCodeMirrorEditor extends IInstance {
  editor: Editor
  doc: {height: number}
}

export const scrolltoBottom = (editor: ReactCodeMirrorEditor) => {
  editor.scrollTo(0, editor.doc.height + 100)
}

const CodeMirrorConsole = (props: Props) => {
  const {res, handleOnChange} = props
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
        value={res}
        options={options}
        onBeforeChange={(): void => {}}
        onTouchStart={(): void => {}}
        onChange={handleOnChange}
      />
    </div>
  )
}

export default CodeMirrorConsole
