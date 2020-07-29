import React, {ChangeEvent, KeyboardEvent} from 'react'

// Components
import {Form, Button, ComponentColor, Input, InputType} from 'src/reusable_ui'
import {ComponentStatus} from 'src/reusable_ui/types'

import {ShellInfo} from 'src/types'

interface Props {
  host: string
  addr: string
  user: string
  pwd: string
  port: string
  isNewEditor: boolean
  handleShellRemove: (nodename: ShellInfo['nodename']) => void
  handleShellUpdate: (shell: ShellInfo) => void
  handleChangeHost: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangeAddress: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangeID: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangePassword: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangePort: (e: ChangeEvent<HTMLInputElement>) => void
  handleOpenTerminal: () => void
}
const ShellForm = (props: Props) => {
  const {
    host,
    addr,
    user,
    pwd,
    port,
    isNewEditor,
    handleOpenTerminal,
    handleChangeHost,
    handleChangeAddress,
    handleChangeID,
    handleChangePassword,
    handleChangePort,
  } = props

  const onKeyPressEnter = function(event: KeyboardEvent<HTMLInputElement>) {
    const enterKeyCode = 13
    const enterKey = 'Enter'

    if (
      event.keyCode === enterKeyCode ||
      event.charCode === enterKeyCode ||
      event.key === enterKey
    ) {
      if (!props.isNewEditor && host && addr && user && pwd && port) {
        handleOpenTerminal()
      }
    }
  }
  return (
    <Form>
      <Form.Element label="Host">
        <Input
          value={host}
          onChange={handleChangeHost}
          onKeyPress={onKeyPressEnter}
          placeholder={'Connect Host'}
          type={InputType.Text}
          status={
            isNewEditor ? ComponentStatus.Default : ComponentStatus.Disabled
          }
        />
      </Form.Element>
      <Form.Element label="Address">
        <Input
          value={addr}
          onChange={handleChangeAddress}
          onKeyPress={onKeyPressEnter}
          placeholder={'Connect Address'}
          type={InputType.Text}
        />
      </Form.Element>
      <Form.Element label="ID">
        <Input
          value={user}
          onChange={handleChangeID}
          onKeyPress={onKeyPressEnter}
          placeholder={'Connect ID'}
          type={InputType.Text}
        />
      </Form.Element>
      <Form.Element label="PASSWORD">
        <Input
          value={pwd}
          onChange={handleChangePassword}
          onKeyPress={onKeyPressEnter}
          placeholder={'Connect Password'}
          type={InputType.Password}
        />
      </Form.Element>
      <Form.Element label="PORT">
        <Input
          value={port}
          onChange={handleChangePort}
          onKeyPress={onKeyPressEnter}
          placeholder={'Connect Port'}
          type={InputType.Text}
        />
      </Form.Element>
      <Form.Footer>
        <Button
          color={ComponentColor.Default}
          text={`Remove`}
          onClick={e => {
            e.stopPropagation()
            props.handleShellRemove(host)
          }}
        />
        {isNewEditor ? (
          <Button
            color={ComponentColor.Primary}
            text={`Add Config`}
            onClick={() => {
              props.handleShellUpdate({isNewEditor, nodename: host})
            }}
          />
        ) : (
          <Button
            color={ComponentColor.Success}
            text={`Connect`}
            onClick={handleOpenTerminal}
          />
        )}
      </Form.Footer>
    </Form>
  )
}

export default ShellForm
