import React, {ChangeEvent, KeyboardEvent} from 'react'

// Components
import {Form, Button, ComponentColor, Input, InputType} from 'src/reusable_ui'

interface Props {
  addr: string
  user: string
  pwd: string
  port: string

  handleChangeAddress: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangeID: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangePassword: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangePort: (e: ChangeEvent<HTMLInputElement>) => void
  handleOpenTerminal: () => void
}
const ShellForm = (props: Props) => {
  const {
    addr,
    user,
    pwd,
    port,
    handleOpenTerminal,
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
      if (addr && user && pwd && port) {
        handleOpenTerminal()
      }
    }
  }
  return (
    <Form>
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
          color={ComponentColor.Success}
          text={`Connect`}
          onClick={handleOpenTerminal}
        />
      </Form.Footer>
    </Form>
  )
}

export default ShellForm
