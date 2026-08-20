import React from 'react'
import {Controlled as ReactCodeMirror} from 'react-codemirror2'
import {Editor} from 'codemirror'
import 'src/external/codemirror'

interface Props {
  res: string
  handleOnChange?: (editor: Editor) => void
}

export const scrolltoBottom = (editor: Editor) => {
  const height = (editor as any)?.doc?.height ?? editor.getScrollInfo?.()?.height ?? 0
  editor.scrollTo(0, height + 100)
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
