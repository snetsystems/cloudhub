import React from 'react'
import classNames from 'classnames'
import _ from 'lodash'

import {Item} from './walk'
import uuid from 'uuid'

const DEFAULT_PADDING = 0.75
const ICON_SIZE = 2
const LEVEL_SPACE = 1.75
const ToggleIcon = ({on}: {on: boolean}) => (
  <div role="img" aria-label="Toggle" className="toggle-icon-symbol">
    {on ? '-' : '+'}
  </div>
)

export interface TreeMenuItem extends Item {
  active?: boolean
  onClick: (event: React.MouseEvent<HTMLLIElement>) => void
  toggleNode?: () => void
}

export type TreeMenuChildren = (props: {
  search?: (term: string) => void
  searchTerm?: string
  items: TreeMenuItem[]
  reset?: (openNodes?: string[]) => void
  handleOpenCspFormBtn: (properties: {[x: string]: any}) => JSX.Element
  handleDeleteRegionBtn: (properties: {[x: string]: any}) => JSX.Element
}) => JSX.Element

export const ItemComponent: React.FunctionComponent<TreeMenuItem> = ({
  hasNodes = false,
  setIcon = '',
  buttons = [],
  isOpen = false,
  disabled = false,
  level = 0,
  onClick,
  toggleNode,
  active,
  focused,
  label = 'unknown',
  style = {},
  parent,
}) => (
  <li
    className={classNames(
      'tree-item',
      {'tree-item--active': active},
      {'tree-item--focused': focused},
      `${'tree-item-level-' + level}`,
      {disabled: disabled}
    )}
    style={{
      paddingLeft: `${
        DEFAULT_PADDING + ICON_SIZE * (hasNodes ? 0 : 1) + level * LEVEL_SPACE
      }rem`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...style,
    }}
    role="button"
    aria-pressed={active}
    data-key={parent.trim() + '/' + label}
    onClick={disabled ? null : onClick}
  >
    {hasNodes && (
      <div
        className="toggle-icon"
        onClick={e => {
          hasNodes && toggleNode && toggleNode()
          e.stopPropagation()
        }}
      >
        <ToggleIcon on={isOpen} />
      </div>
    )}

    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        minHeight: '22px',
      }}
    >
      {setIcon && <span className={setIcon}></span>}
      <div style={{width: '100%'}}>{label}</div>
      {buttons && (
        <div className={`tree-item-buttons`}>
          {_.map(buttons, item => (
            <span key={uuid.v4()} style={{marginLeft: '3px'}}>
              {item()}
            </span>
          ))}
        </div>
      )}
    </div>
  </li>
)

export const defaultChildren: TreeMenuChildren = ({search, items}) => {
  const onSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {value} = e.target
    search && search(value)
  }
  return (
    <>
      {search && (
        <input
          className="tree-search"
          aria-label="Filter"
          type="search"
          placeholder="Filter by Name..."
          onChange={onSearch}
        />
      )}
      <ul className="tree-item-group">
        {items.map(props => (
          <ItemComponent {...props} />
        ))}
      </ul>
    </>
  )
}

export type CspTreeMenuChildren = (props: {
  search?: (term: string) => void
  searchTerm?: string
  items: TreeMenuItem[]
  reset?: (openNodes?: string[]) => void
  handleOpenCspFormBtn: (properties: {[x: string]: any}) => JSX.Element
  handleDeleteRegionBtn: (properties: {[x: string]: any}) => JSX.Element
}) => JSX.Element

export const ItemComponentCSP: React.FunctionComponent<TreeMenuItem> = ({
  hasNodes = false,
  setIcon = '',
  buttons = [],
  isOpen = false,
  disabled = false,
  level = 0,
  onClick,
  toggleNode,
  active,
  focused,
  label = 'unknown',
  style = {},
  parent,
  instanceid,
  provider,
  region,
  handleOpenCspFormBtn,
  handleDeleteRegionBtn,
}) => (
  <li
    className={classNames(
      'tree-item',
      {'tree-item--active': active},
      {'tree-item--focused': focused},
      `${'tree-item-level-' + level}`,
      {disabled: disabled}
    )}
    style={{
      paddingLeft: `${
        DEFAULT_PADDING + ICON_SIZE * (hasNodes ? 0 : 1) + level * LEVEL_SPACE
      }rem`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      ...style,
    }}
    role="button"
    aria-pressed={active}
    data-parent={parent.trim()}
    data-label={label}
    data-level={level}
    data-instanceid={instanceid ? instanceid : ''}
    data-provider={provider ? provider : ''}
    data-region={region ? region : ''}
    data-navi={
      instanceid ? `${provider}.nodes.${region}.nodes.${instanceid}` : ''
    }
    onClick={disabled ? null : onClick}
  >
    {hasNodes && (
      <div
        className="toggle-icon"
        onClick={e => {
          hasNodes && toggleNode && toggleNode()
          e.stopPropagation()
        }}
      >
        <ToggleIcon on={isOpen} />
      </div>
    )}

    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        minHeight: '22px',
      }}
    >
      {setIcon && <span className={setIcon}></span>}
      <div style={{width: '100%'}}>{label}</div>
      {buttons && (
        <div className={`tree-item-buttons`}>
          {_.map(buttons, button =>
            button.isDeleteCloud ? (
              <span key={uuid.v4()}>{handleDeleteRegionBtn(button)}</span>
            ) : (
              <span key={uuid.v4()}>{handleOpenCspFormBtn(button)}</span>
            )
          )}
        </div>
      )}
    </div>
  </li>
)

export const defaultChildrenCSP: CspTreeMenuChildren = ({
  search,
  items,
  handleOpenCspFormBtn,
  handleDeleteRegionBtn,
}) => {
  const onSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {value} = e.target
    search && search(value)
  }
  return (
    <>
      {search && (
        <input
          className="tree-search"
          aria-label="Filter"
          type="search"
          placeholder="Filter by Name..."
          onChange={onSearch}
        />
      )}
      <ul className="tree-item-group">
        {items.map(props => {
          props = {...props, handleOpenCspFormBtn, handleDeleteRegionBtn}
          return <ItemComponentCSP {...props} />
        })}
      </ul>
    </>
  )
}
