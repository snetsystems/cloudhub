import React, {PureComponent} from 'react'

// Components
import {Dropdown, DropdownMode} from 'src/reusable_ui'

// Types
import {ComponentColor, ComponentSize, IconFont} from 'src/reusable_ui/types'

interface Props {
  onSelect: (item: string) => void
}

class AddPanelDropdown extends PureComponent<Props> {
  public render() {
    return (
      <Dropdown
        mode={DropdownMode.ActionList}
        buttonColor={ComponentColor.Primary}
        buttonSize={ComponentSize.Small}
        icon={IconFont.PlusSkinny}
        titleText="Add"
        onChange={this.props.onSelect}
        widthPixels={160}
      >
        <Dropdown.Item id="visualization" value="visualization">
          Visualization
        </Dropdown.Item>
        <Dropdown.Item id="import" value="import">
          Import from library
        </Dropdown.Item>
        <Dropdown.Item id="row" value="row">
          Row
        </Dropdown.Item>
        <Dropdown.Item id="paste" value="paste">
          Paste panel
        </Dropdown.Item>
      </Dropdown>
    )
  }
}

export default AddPanelDropdown
