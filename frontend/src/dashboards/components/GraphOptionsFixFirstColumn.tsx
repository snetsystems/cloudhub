import React, {FunctionComponent} from 'react'

interface Props {
  fixed: boolean
  onToggleFixFirstColumn: () => void
}

const GraphOptionsFixFirstColumn: FunctionComponent<Props> = ({
  fixed,
  onToggleFixFirstColumn,
}) => (
  <div
    className="form-group col-xs-12"
    style={{width: '50%', marginBottom: '0px'}}
  >
    <div
      className="form-control-static"
      style={{minHeight: 'unset', padding: '5px 9px'}}
    >
      <input
        type="checkbox"
        id="fixFirstColumnCheckbox"
        checked={!!fixed}
        onChange={onToggleFixFirstColumn}
      />
      <label htmlFor="fixFirstColumnCheckbox">Lock First Column</label>
    </div>
  </div>
)

export default GraphOptionsFixFirstColumn
