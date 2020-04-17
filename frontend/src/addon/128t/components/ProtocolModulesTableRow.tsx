// Libraries
import React, {PureComponent} from 'react'

// Components
import {TableBodyRowItem} from 'src/addon/128t/reusable/layout'

// Constants
import {PROTOCOL_MODULES_TABLE_SIZING} from 'src/addon/128t/constants'

// Type
import {ProtocolModule} from 'src/addon/128t/types'

// Error Handler
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props {
  protocolModule: ProtocolModule
  onClickRow: (name: string) => void
  focusedInProtocolModule: ProtocolModule['name']
}

@ErrorHandling
class ProtocolModulesTableRow extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  render() {
    const {protocolModule, onClickRow, focusedInProtocolModule} = this.props
    const {name, version, status} = protocolModule
    const {
      PROTOCOL_MODULES_NAME,
      PROTOCOL_MODULES_VERSION,
      PROTOCOL_MODULES_STATUS,
    } = PROTOCOL_MODULES_TABLE_SIZING

    return (
      <div
        className={this.focusedClasses(focusedInProtocolModule)}
        onClick={() => {
          onClickRow(name)
        }}
        style={{cursor: 'pointer'}}
      >
        <TableBodyRowItem
          title={name}
          width={PROTOCOL_MODULES_NAME}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={version}
          width={PROTOCOL_MODULES_VERSION}
          className={'align--end'}
        />
        <TableBodyRowItem
          title={status}
          width={PROTOCOL_MODULES_STATUS}
          className={'align--end'}
        />
      </div>
    )
  }

  private focusedClasses = (
    focusedInProtocolModule: ProtocolModule['name']
  ): string => {
    const {protocolModule} = this.props
    if (protocolModule.name === focusedInProtocolModule)
      return 'hosts-table--tr focused'
    return 'hosts-table--tr'
  }
}

export default ProtocolModulesTableRow
