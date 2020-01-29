import React from 'react'
import classnames from 'classnames'
import chroma from 'chroma-js'

// constants
import {DEFAULT_CELL_BG_COLOR} from 'src/dashboards/constants'

//type
import {Router, TopSource, TopSession} from 'src/addon/128t/types'

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
  return children
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
}: {
  cellTextColor: string
  cellBackgroundColor: string
  value: Router[] | TopSource[] | TopSession[] | []
  name: string
}): JSX.Element => {
  let nameStyle = {}

  if (cellBackgroundColor !== DEFAULT_CELL_BG_COLOR) {
    nameStyle = {
      color: cellTextColor,
    }
  }

  return (
    <>
      <h2
        className={`dash-graph--name grid-layout--draggable`}
        style={nameStyle}
      >
        {value.length + ' ' + name}
      </h2>
    </>
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
