// Libraries
import React, {PureComponent} from 'react'

// Constants
import {
  COLLECTOR_CONFIG_TABLE_DATA,
  COLLECTOR_DROPDOWN_DATA,
} from 'src/agent_admin/constants'

// Types
import {CollectorConfigTableData} from 'src/agent_admin/type/agent'

// Decorators
import {ErrorHandling} from 'src/shared/decorators/errors'

// Components
import {Dropdown, MultiSelectDropdown} from 'src/reusable_ui'

interface Props {
  selectedService: string[]
  collectorConfigTableData: CollectorConfigTableData
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleUpdateEnableServices: (selectedEnableServices: string[]) => void
  handleSaveClick: () => void
}

@ErrorHandling
class CollectorConfigTable extends PureComponent<Props> {
  constructor(props: Props) {
    super(props)
  }

  public render() {
    return (
      <>
        <div style={{height: '100%', maxHeight: '555px'}}>
          {this.CollectorConfigTable}
          {this.SaveButton}
        </div>
      </>
    )
  }

  private get CollectorConfigTable() {
    const collectorConfigTableData = COLLECTOR_CONFIG_TABLE_DATA

    return collectorConfigTableData.map(tableData => {
      const {name, label, placeholder, inputType, disabled} = tableData
      const {collectorConfigTableData, handleInputChange} = this.props
      const cloudInputValue = collectorConfigTableData[name]

      if (name === 'service') {
        return this.EnabledService
      }

      return (
        <div
          className={`form-group `}
          style={{
            height: '13%',
            padding: '2.5% 0% 0% 3%',
            marginBottom: 'unset',
          }}
          key={name}
        >
          <label htmlFor={name}>{label}</label>
          <input
            className="form-control"
            id={name}
            name={name}
            value={cloudInputValue}
            spellCheck={false}
            placeholder={placeholder}
            type={inputType}
            disabled={disabled}
            onChange={handleInputChange}
          />
        </div>
      )
    })
  }

  private get EnabledService() {
    const {selectedService, handleUpdateEnableServices} = this.props
    const collectorDropdownData = COLLECTOR_DROPDOWN_DATA

    return (
      <div
        key={'service'}
        className={`form-group`}
        style={{padding: '3.5% 0% 0% 3%', marginBottom: 'unset'}}
      >
        <label htmlFor={'service'}>{'Collecting Service'}</label>
        <MultiSelectDropdown
          selectedIDs={selectedService}
          onChange={handleUpdateEnableServices}
          emptyText={'Choose Service'}
          maxMenuHeight={145}
        >
          {collectorDropdownData.map(service => (
            <Dropdown.Item key={service} id={service} value={{id: service}}>
              {service}
            </Dropdown.Item>
          ))}
        </MultiSelectDropdown>
      </div>
    )
  }

  private get SaveButton() {
    const {handleSaveClick} = this.props
    const buttonClassName = 'button button-sm button-primary'
    const buttonStyle = {margin: '2% 0% 0% 48%'}
    const buttonName = 'Save'

    return (
      <button
        className={buttonClassName}
        style={buttonStyle}
        onClick={handleSaveClick}
      >
        {buttonName}
      </button>
    )
  }
}

export default CollectorConfigTable
