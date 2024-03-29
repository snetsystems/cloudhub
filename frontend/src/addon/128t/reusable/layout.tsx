// Libraries
import React, {CSSProperties} from 'react'
import classnames from 'classnames'
import chroma from 'chroma-js'

// Constants
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'

// Type
import {
  RouterNode,
  TopSource,
  TopSession,
  SortDirection,
} from 'src/addon/128t/types'

export const Panel = ({
  children,
}: {
  children: JSX.Element | JSX.Element[]
}): JSX.Element => {
  return <div className="panel">{children}</div>
}

export const PanelHeader = ({isEditable, children}) => {
  return (
    <div className="panel-heading">
      <div
        className={classnames('dash-graph--heading', {
          'dash-graph--draggable dash-graph--heading-draggable': isEditable,
          'dash-graph--heading-draggable': isEditable,
        })}
      >
        {children}
      </div>
    </div>
  )
}

export const PanelBody = ({children}: {children: JSX.Element}): JSX.Element => {
  return <div className="panel-body">{children}</div>
}

export const Table = ({
  children,
}: {
  children: JSX.Element | JSX.Element[]
}): JSX.Element => {
  return <div className="hosts-table">{children}</div>
}

export const TableHeader = ({
  children,
}: {
  children: JSX.Element
}): JSX.Element => {
  return (
    <div className="hosts-table--thead">
      <div className={'hosts-table--tr'}>{children}</div>
    </div>
  )
}

export const TableBody = ({children}: {children: JSX.Element}): JSX.Element => {
  return <div className="hosts-table--tbody">{children}</div>
}

export const TableBodyRowItem = ({
  width,
  title,
  className,
}: {
  width: string
  title: string | number | JSX.Element
  className?: string
}): JSX.Element => {
  return (
    <div className={`hosts-table--td ${className}`} style={{width: width}}>
      {title || title === 0 ? title : '-'}
    </div>
  )
}

export const CellName = ({
  cellTextColor,
  cellBackgroundColor,
  value,
  name,
  setIcon = '',
  sizeVisible = true,
}: {
  cellTextColor: string
  cellBackgroundColor: string
  value: RouterNode[] | TopSource[] | TopSession[] | []
  name: string
  setIcon?: string
  sizeVisible?: boolean
}): JSX.Element | null => {
  let nameStyle = {}

  if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
    nameStyle = {
      color: cellTextColor,
    }
  }

  return (
    <h2 className={`dash-graph--name grid-layout--draggable`} style={nameStyle}>
      {setIcon && <span className={setIcon} />}{' '}
      {sizeVisible ? value.length : null} {name}
    </h2>
  )
}

export const HeadingBar = ({
  isEditable,
  cellBackgroundColor,
}: {
  isEditable: boolean
  cellBackgroundColor: string
}): JSX.Element => {
  if (isEditable) {
    let barStyle = {}

    if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
      barStyle = {
        backgroundColor: chroma(cellBackgroundColor).brighten(),
      }
    }

    return (
      <>
        <div className="dash-graph--heading-bar" style={barStyle} />
        <div className="dash-graph--heading-dragger" />
      </>
    )
  }
}

export const ErrorState = (): JSX.Element => (
  <div className="generic-empty-state">
    <h4 style={{margin: '90px 0'}}>There was a problem loading hosts</h4>
  </div>
)

export const NoHostsState = ({style}: {style?: CSSProperties}): JSX.Element => (
  <div className="generic-empty-state" style={style}>
    <h4>No Data.</h4>
  </div>
)

export const NoSortedHostsState = (): JSX.Element => (
  <div className="generic-empty-state">
    <h4 style={{margin: '90px 0'}}>
      There are no hosts that match the search criteria
    </h4>
  </div>
)

export const sortableClasses = ({
  sortKey,
  sortDirection,
  key,
}: {
  sortKey: string
  sortDirection: SortDirection
  key: string
}): string => {
  if (sortKey === key) {
    if (sortDirection === SortDirection.ASC) {
      return 'hosts-table--th sortable-header sorting-ascending'
    }
    return 'hosts-table--th sortable-header sorting-descending'
  }
  return 'hosts-table--th sortable-header'
}

export const usageIndacator = ({
  value,
}: {
  value: string | number | React.ReactText
}): JSX.Element => {
  if (!value) return
  const numValue = parseInt(value.toString())

  return (
    <div className="UsageIndacator-container">
      <div
        className={classnames('UsageIndacator-value', {
          'UsageIndacator--caution': numValue >= 50,
          'UsageIndacator--warning': numValue >= 70,
          'UsageIndacator--danger': numValue >= 90,
        })}
      >
        {value}
      </div>
      <div
        className={classnames('UsageIndacator', {
          'UsageIndacator--caution': numValue >= 50,
          'UsageIndacator--warning': numValue >= 70,
          'UsageIndacator--danger': numValue >= 90,
        })}
      ></div>
    </div>
  )
}

export const usageTemperature = ({
  value,
}: {
  value: string | number | React.ReactText
}): JSX.Element => {
  if (!value) return
  const numValue = parseInt(value.toString())

  return (
    <div className="UsageIndacator-container">
      <div
        className={classnames('UsageIndacator-value', {
          'UsageIndacator--caution': numValue >= 40,
          'UsageIndacator--warning': numValue >= 50,
          'UsageIndacator--danger': numValue >= 60,
        })}
      >
        {value}
      </div>
      <div
        className={classnames('UsageIndacator', {
          'UsageIndacator--caution': numValue >= 40,
          'UsageIndacator--warning': numValue >= 50,
          'UsageIndacator--danger': numValue >= 60,
        })}
      ></div>
    </div>
  )
}

export const usageSound = ({
  value,
}: {
  value: string | number | React.ReactText
}): JSX.Element => {
  if (!value) return
  const numValue = parseInt(value.toString())

  return (
    <div className="UsageIndacator-container">
      <div
        className={classnames('UsageIndacator-value', {
          'UsageIndacator--caution': numValue >= 45,
          'UsageIndacator--warning': numValue >= 55,
          'UsageIndacator--danger': numValue >= 65,
        })}
      >
        {value}
      </div>
      <div
        className={classnames('UsageIndacator', {
          'UsageIndacator--caution': numValue >= 45,
          'UsageIndacator--warning': numValue >= 55,
          'UsageIndacator--danger': numValue >= 65,
        })}
      ></div>
    </div>
  )
}

export const unitIndicator = (
  value: string | number,
  splitUnit: string
): JSX.Element => {
  const divider = String(value).split(splitUnit)
  return (
    <>
      {divider[0]}
      <span className="indicator-unit--wrap">
        <span className="indicator-unit">{divider[1]}</span>
      </span>
    </>
  )
}

export const numberWithCommas = (x: number): string => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
