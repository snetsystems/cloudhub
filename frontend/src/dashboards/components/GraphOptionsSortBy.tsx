import React from 'react'
import Dropdown from 'src/shared/components/Dropdown'
import {Radio, ButtonShape} from 'src/reusable_ui'

interface Option {
  text: string
  key: string
}

interface TableColumn {
  internalName: string
  displayName: string
}

interface Props {
  sortByOptions: any[]
  selected: TableColumn
  selectedDirection: 'asc' | 'desc'
  onChooseSortBy: (option: Option) => void
  onChooseSortByDirection: (direction: 'asc' | 'desc') => void
}

const GraphOptionsSortBy = ({
  sortByOptions,
  onChooseSortBy,
  selected,
  selectedDirection,
  onChooseSortByDirection,
}: Props) => {
  const selectedValue = selected.displayName || selected.internalName
  return (
    <div className="form-group col-xs-6" style={{width: '100%'}}>
      <label>Default Sort Field</label>
      <div className="sort-field">
        <Dropdown
          items={sortByOptions}
          selected={selectedValue}
          buttonColor="btn-default"
          buttonSize="btn-sm"
          className="dropdown-stretch"
          onChoose={onChooseSortBy}
        />
      </div>
      <Radio shape={ButtonShape.StretchToFit} customClass="sort-direction">
        <Radio.Button
          id="sort-direction--ascending"
          value={'asc'}
          active={selectedDirection === 'asc' ? true : false}
          onClick={onChooseSortByDirection}
          titleText="Sort by Aescending Order"
        >
          Ascending
        </Radio.Button>
        <Radio.Button
          id="sort-direction--descending"
          value={'desc'}
          active={selectedDirection === 'desc' ? true : false}
          onClick={onChooseSortByDirection}
          titleText="Sort by Descending Order"
        >
          Descending
        </Radio.Button>
      </Radio>
    </div>
  )
}

export default GraphOptionsSortBy
