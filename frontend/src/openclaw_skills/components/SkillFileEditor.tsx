import React, {FC, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import classnames from 'classnames'

import {
  Button,
  ButtonShape,
  ComponentColor,
  ComponentSize,
  Dropdown,
  DropdownMenuColors,
  IconFont,
} from 'src/reusable_ui'
import {OpenClawSkillFile} from 'src/types/openclawSkills'
import {
  SUPPORT_FOLDERS,
  byteLength,
  folderForFile,
  splitPath,
} from 'src/openclaw_skills/utils/validation'

interface Props {
  files: OpenClawSkillFile[]
  onChange: (files: OpenClawSkillFile[]) => void
}

/*
  Support file content is stored as a UTF-8 string, so only text files can be
  attached. A binary file decodes into replacement characters, which the
  backend would reject as invalid UTF-8 — catching it here says why.
*/
const readTextFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(file.name))
    reader.onload = () => {
      const text = String(reader.result)
      if (text.includes('\uFFFD') || text.includes('\u0000')) {
        reject(new Error(file.name))
        return
      }
      resolve(text)
    }
    reader.readAsText(file)
  })

const SkillFileEditor: FC<Props> = ({files, onChange}) => {
  const {t} = useTranslation()
  const picker = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])

  const update = (index: number, patch: Partial<OpenClawSkillFile>) => {
    onChange(files.map((file, i) => (i === index ? {...file, ...patch} : file)))
  }

  const setFolder = (index: number, folder: string) => {
    const {name} = splitPath(files[index].path)
    update(index, {path: `${folder}${name}`})
  }

  const setName = (index: number, name: string) => {
    const {folder} = splitPath(files[index].path)
    update(index, {path: `${folder}${name.replace(/^\/+/, '')}`})
  }

  const remove = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  const add = () => {
    onChange([...files, {path: SUPPORT_FOLDERS[0], content: ''}])
  }

  const ingest = async (incoming: FileList) => {
    const added: OpenClawSkillFile[] = []
    const failed: string[] = []

    for (const file of Array.from(incoming)) {
      try {
        added.push({
          path: `${folderForFile(file.name)}${file.name}`,
          content: await readTextFile(file),
        })
      } catch {
        failed.push(file.name)
      }
    }

    setRejected(failed)
    if (added.length) {
      onChange([...files, ...added])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) {
      ingest(e.dataTransfer.files)
    }
  }

  return (
    <div
      className={classnames('openclaw-skills--files', {dragging})}
      onDragOver={e => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {files.map((file, index) => {
        const {folder, name} = splitPath(file.path)

        return (
          <div className="openclaw-skills--file" key={index}>
            <div className="openclaw-skills--file-header">
              <Dropdown
                selectedID={folder}
                onChange={(value: string) => setFolder(index, value)}
                menuColor={DropdownMenuColors.Onyx}
                buttonSize={ComponentSize.Small}
                widthPixels={130}
              >
                {SUPPORT_FOLDERS.map(candidate => (
                  <Dropdown.Item
                    key={candidate}
                    id={candidate}
                    value={candidate}
                  >
                    {candidate}
                  </Dropdown.Item>
                ))}
              </Dropdown>
              <input
                className="form-control input-sm monotype"
                value={name}
                placeholder={t('openclaw_skills.author.name_placeholder')}
                onChange={e => setName(index, e.target.value)}
              />
              <span className="openclaw-skills--file-size">
                {byteLength(file.content).toLocaleString()} B
              </span>
              <Button
                icon={IconFont.Remove}
                shape={ButtonShape.Square}
                size={ComponentSize.Small}
                color={ComponentColor.Danger}
                titleText={t('openclaw_skills.author.remove_file')}
                onClick={() => remove(index)}
              />
            </div>
            <textarea
              className="form-control input-sm monotype openclaw-skills--file-body"
              value={file.content}
              onChange={e => update(index, {content: e.target.value})}
            />
          </div>
        )
      })}

      {!files.length && (
        <div className="openclaw-skills--files-empty">
          {t('openclaw_skills.author.no_files')}
        </div>
      )}

      {rejected.length > 0 && (
        <div className="openclaw-skills--error">
          {t('openclaw_skills.author.not_text', {files: rejected.join(', ')})}
        </div>
      )}

      <div className="openclaw-skills--files-actions">
        <Button
          text={t('openclaw_skills.author.upload_file')}
          icon={IconFont.Import}
          size={ComponentSize.Small}
          color={ComponentColor.Primary}
          onClick={() => picker.current?.click()}
        />
        <Button
          text={t('openclaw_skills.author.add_file')}
          icon={IconFont.Plus}
          size={ComponentSize.Small}
          onClick={add}
        />
        <span className="openclaw-skills--files-hint">
          {t('openclaw_skills.author.drop_hint')}
        </span>
      </div>

      <input
        ref={picker}
        type="file"
        multiple={true}
        style={{display: 'none'}}
        onChange={e => {
          if (e.target.files?.length) {
            ingest(e.target.files)
          }
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default SkillFileEditor
