// Library
import React, {ChangeEvent} from 'react'

import {Form, Input, InputType} from 'src/reusable_ui'
import Dropdown from 'src/shared/components/Dropdown'

interface Props {
  target: string
  address: string
  port: string
  user: string
  password: string
  protocol: string
  interval: string
  targetItems: string[]
  intervalItems: string[]
  handleChangeTarget: (e: {text: string}) => void
  handleChangeAddress: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangePort: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangeUser: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangePassword: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangeProtocol: (e: ChangeEvent<HTMLInputElement>) => void
  handleChangeInterval: (e: {text: string}) => void
}
const VMConnectForm = ({
  target,
  address,
  port,
  user,
  password,
  protocol,
  interval,
  targetItems,
  intervalItems,
  handleChangeTarget,
  handleChangeAddress,
  handleChangePort,
  handleChangeUser,
  handleChangePassword,
  handleChangeProtocol,
  handleChangeInterval,
}: Props) => {
  return (
    <Form>
      <Form.Element label="Using Minion" colsXS={12}>
        <Dropdown
          value={'minionasd'}
          items={targetItems}
          onChoose={handleChangeTarget}
          selected={target}
          className="dropdown-stretch"
          disabled={false}
        />
      </Form.Element>
      <Form.Element label="Connection vCenter" colsXS={8}>
        <Input
          value={address}
          onChange={handleChangeAddress}
          placeholder={'Connect Address'}
          type={InputType.Text}
        />
      </Form.Element>
      <Form.Element label="Port" colsXS={4}>
        <Input
          value={port}
          onChange={handleChangePort}
          placeholder={'Connect Port'}
          type={InputType.Text}
        />
      </Form.Element>

      <Form.Element label="ID" colsXS={6}>
        <Input
          value={user}
          onChange={handleChangeUser}
          placeholder={'Connect ID'}
          type={InputType.Text}
        />
      </Form.Element>
      <Form.Element label="Password" colsXS={6}>
        <Input
          value={password}
          onChange={handleChangePassword}
          placeholder={'Connect Password'}
          type={InputType.Password}
        />
      </Form.Element>
      <Form.Element label="Protocol" colsXS={6}>
        <Input
          value={protocol}
          onChange={handleChangeProtocol}
          placeholder={'Default https'}
          type={InputType.Text}
        />
      </Form.Element>
      <Form.Element label="Interval" colsXS={6}>
        <Dropdown
          items={intervalItems}
          onChoose={handleChangeInterval}
          selected={interval}
          className="dropdown-stretch"
          disabled={false}
        />
      </Form.Element>
    </Form>
  )
}

export default VMConnectForm
