import React from 'react'
import _, {debounce} from 'lodash'

import walk, {
  TreeNode,
  Item,
  TreeNodeInArray,
  LocaleFunction,
  MatchSearchFunction,
} from 'src/reusable_ui/components/treemenu/TreeMenu/walk'
import {
  CspTreeMenuChildren,
  defaultChildrenCSP,
  TreeMenuItem,
} from 'src/reusable_ui/components/treemenu/TreeMenu/renderProps'
import KeyDown from 'src/reusable_ui/components/treemenu/KeyDown'
import {mxGraph as mxGraphType} from 'mxgraph'
import {dragCell, drawCellInGroup} from '../configurations/topology'
import {mxEvent, mxUtils} from '../containers/InventoryTopology'

export type TreeMenuProps = {
  data: {[name: string]: TreeNode} | TreeNodeInArray[]
  graph: mxGraphType
  activeKey?: string
  focusKey?: string
  initialActiveKey?: string
  initialFocusKey?: string
  initialOpenNodes?: string[]
  openNodes?: string[]
  hasSearch?: boolean
  onClickItem?: (props: Item) => void
  debounceTime?: number
  children?: CspTreeMenuChildren
  locale?: LocaleFunction
  matchSearch?: MatchSearchFunction
  handleOpenCspFormBtn?: (properties: {[x: string]: any}) => JSX.Element
  handleDeleteRegionBtn?: (properties: {[x: string]: any}) => JSX.Element
}

type TreeMenuState = {
  openNodes: string[]
  searchTerm: string
  activeKey: string
  focusKey: string
}

const defaultOnClick = (props: Item) => console.log(props) // eslint-disable-line no-console

class InventoryTreemenu extends React.Component<TreeMenuProps, TreeMenuState> {
  static defaultProps: TreeMenuProps = {
    data: {},
    graph: null,
    onClickItem: defaultOnClick,
    debounceTime: 125,
    children: defaultChildrenCSP,
    hasSearch: true,
  }

  state: TreeMenuState = {
    openNodes: this.props.initialOpenNodes || [],
    searchTerm: '',
    activeKey: this.props.initialActiveKey || '',
    focusKey: this.props.initialFocusKey || '',
  }

  reset = (newOpenNodes?: string[]) => {
    const {initialOpenNodes} = this.props
    const openNodes =
      (Array.isArray(newOpenNodes) && newOpenNodes) || initialOpenNodes || []
    this.setState({openNodes, searchTerm: ''})
  }

  search = (value: string) => {
    const {debounceTime} = this.props
    const search = debounce(
      (searchTerm: string) => this.setState({searchTerm}),
      debounceTime
    )
    search(value)
  }

  toggleNode = (node: string) => {
    if (!this.props.openNodes) {
      const {openNodes} = this.state
      const newOpenNodes = openNodes.includes(node)
        ? openNodes.filter(openNode => openNode !== node)
        : [...openNodes, node]
      this.setState({openNodes: newOpenNodes})
    }
  }

  generateItems = (): TreeMenuItem[] => {
    const {data, onClickItem, locale, matchSearch} = this.props
    const {searchTerm} = this.state
    const openNodes = this.props.openNodes || this.state.openNodes
    const activeKey = this.props.activeKey || this.state.activeKey
    const focusKey = this.props.focusKey || this.state.focusKey

    const items: Item[] = data
      ? walk({data, openNodes, searchTerm, locale, matchSearch})
      : []

    return items.map(item => {
      const focused = item.key === focusKey
      const active = item.key === activeKey

      const onClick = () => {
        const newActiveKey = this.props.activeKey || item.key
        this.setState({activeKey: newActiveKey, focusKey: newActiveKey})
        onClickItem && onClickItem(item)
      }

      const toggleNode = item.hasNodes
        ? () => this.toggleNode(item.key)
        : undefined

      const newItem = {...item, focused, active, onClick, toggleNode}
      return newItem
    })
  }

  getKeyDownProps = (items: TreeMenuItem[]) => {
    const {onClickItem} = this.props
    const {focusKey, activeKey} = this.state
    const focusIndex = items.findIndex(
      item => item.key === (focusKey || activeKey)
    )
    const getFocusKey = (item: TreeMenuItem) => {
      const keyArray = item.key.split('/')

      return keyArray.length > 1
        ? keyArray.slice(0, keyArray.length - 1).join('/')
        : item.key
    }

    return {
      up: () => {
        this.setState(({focusKey}) => ({
          focusKey: focusIndex > 0 ? items[focusIndex - 1].key : focusKey,
        }))
      },
      down: () => {
        this.setState(({focusKey}) => ({
          focusKey:
            focusIndex < items.length - 1
              ? items[focusIndex + 1].key
              : focusKey,
        }))
      },
      left: () => {
        this.setState(({openNodes, ...rest}) => {
          const item = items[focusIndex]
          const newOpenNodes = openNodes.filter(node => node !== item.key)

          return item.isOpen
            ? {...rest, openNodes: newOpenNodes, focusKey: item.key}
            : {...rest, focusKey: getFocusKey(item)}
        })
      },
      right: () => {
        const {hasNodes, key} = items[focusIndex]
        if (hasNodes)
          this.setState(({openNodes}) => ({openNodes: [...openNodes, key]}))
      },
      enter: () => {
        this.setState(({focusKey}) => ({activeKey: focusKey}))
        onClickItem && onClickItem(items[focusIndex])
      },
    }
  }

  public addSidbarTreemenu = function ({
    sideBarArea,
    element,
  }: {
    sideBarArea: HTMLElement
    node: {
      type: string
      name: string
      label: string
      link?: string
      using_minion?: string
      ipmi_Host?: string
      ipmi_User?: string
      ipmi_Pass?: string
      [key: string]: any
    }
    element: HTMLDivElement
    iconClassName?: string
  }) {
    sideBarArea.appendChild(element)
  }

  public componentDidMount() {
    this.changedDOM()
  }

  public componentDidUpdate(_prevProps, prevState: TreeMenuState) {
    if (prevState.openNodes !== this.state.openNodes) {
      this.changedDOM()
    }
  }

  public render() {
    const {
      children,
      hasSearch,
      handleOpenCspFormBtn,
      handleDeleteRegionBtn,
    } = this.props
    const {searchTerm} = this.state

    const items = this.generateItems()
    const renderedChildren = children || defaultChildrenCSP
    const keyDownProps = this.getKeyDownProps(items)

    return (
      <KeyDown {...keyDownProps}>
        <div id={'cloudInventoryContainer'}>
          {renderedChildren(
            hasSearch
              ? {
                  search: this.search,
                  items,
                  reset: this.reset,
                  searchTerm,
                  handleOpenCspFormBtn,
                  handleDeleteRegionBtn,
                }
              : {
                  items,
                  reset: this.reset,
                  handleOpenCspFormBtn,
                  handleDeleteRegionBtn,
                }
          )}
        </div>
      </KeyDown>
    )
  }

  private changedDOM = () => {
    const {data} = this.props
    const treemenus = document
      .querySelector('#cloudInventoryContainer .tree-item-group')
      .querySelectorAll('li')

    treemenus.forEach(menu => {
      mxEvent.removeAllListeners(menu)
    })

    _.forEach(treemenus, el => {
      const dragElt = document.createElement('div')
      if (el.getAttribute('data-level') === '1') {
        dragElt.style.border = 'dashed #f58220 1px'
        dragElt.style.width = `${110}px`
        dragElt.style.height = `${110}px`

        const childCells = _.get(
          data,
          `${el.getAttribute('data-parent')}.nodes.${el.getAttribute(
            'data-label'
          )}.nodes`
        )

        const nodes = _.map(childCells, childCell => {
          const value = _.get(childCell, 'label')
          const instanseId = _.get(childCell, 'instanceid')

          const node = {
            label: value,
            link: '',
            name: value,
            type: 'Server',
            parent:
              el.getAttribute('data-parent') +
              '(' +
              el.getAttribute('data-label') +
              ')',
            data_navi: `${el.getAttribute(
              'data-parent'
            )}.nodes.${el.getAttribute('data-label')}.nodes.${instanseId}`,
            status: true,
            detected: true,
          }
          return node
        })

        let ds = mxUtils.makeDraggable(
          el,
          this.props.graph,
          drawCellInGroup(nodes),
          dragElt,
          0,
          0,
          true,
          true
        )

        ds.setGuidesEnabled(true)
      } else if (el.getAttribute('data-level') === '2') {
        dragElt.style.border = 'dashed #f58220 1px'
        dragElt.style.width = `${90}px`
        dragElt.style.height = `${90}px`

        const value = el.getAttribute('data-label')
        const dataNavi = el.getAttribute('data-navi')
        const node = {
          label: value,
          link: '',
          name: value,
          type: 'Server',
          data_navi: dataNavi,
          status: true,
          detected: true,
        }

        let ds = mxUtils.makeDraggable(
          el,
          this.props.graph,
          dragCell(node),
          dragElt,
          0,
          0,
          true,
          true
        )

        ds.setGuidesEnabled(true)
      }
    })
  }
}

export default InventoryTreemenu
