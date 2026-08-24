import React, {FC} from 'react'
import {Controlled as ReactCodeMirror} from 'react-codemirror2'
import {Editor, EditorChange} from 'codemirror'
import 'src/external/codemirror'

interface Props {
  value: string
  onChange: (value: string) => void
}

// SKILL.md is markdown with a YAML frontmatter block, so it gets the same
// editor the dashboard cell notes use rather than a bare textarea.
const options = {
  tabIndex: 1,
  mode: 'markdown',
  readonly: false,
  lineNumbers: true,
  autoRefresh: true,
  theme: 'markdown',
  completeSingle: false,
  lineWrapping: true,
}

const SkillMainEditor: FC<Props> = ({value, onChange}) => {
  const handleChange = (
    _editor: Editor,
    _change: EditorChange,
    next: string
  ) => {
    onChange(next)
  }

  return (
    <div className="openclaw-skills--code">
      <ReactCodeMirror
        autoCursor={true}
        value={value}
        options={options}
        onBeforeChange={handleChange}
        onTouchStart={() => {}}
      />
    </div>
  )
}

export default SkillMainEditor
