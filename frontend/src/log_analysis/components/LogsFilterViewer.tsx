import React from 'react'
import classnames from 'classnames'
import {LogsFilterClause, TimeZones} from 'src/types'
import {ClickOutside} from 'src/shared/components/ClickOutside'
import {getLogsFilterLabel} from 'src/log_analysis/util'

interface Props {
  filter: LogsFilterClause
  timeZone?: TimeZones
  onDelete: (id: string) => void
}

const LogsFilterViewer: React.FC<Props> = ({filter, timeZone, onDelete}) => {
  const {id} = filter

  const handleDelete = (): void => {
    onDelete(id)
  }

  return (
    <ClickOutside onClickOutside={() => {}}>
      <div className={classnames('logs-viewer--filter')}>
        <span>{getLogsFilterLabel(filter, timeZone)}</span>
        <div
          className="logs-viewer--filter-remove"
          onClick={handleDelete}
          title="Remove filter"
        />
      </div>
    </ClickOutside>
  )
}

export default LogsFilterViewer
