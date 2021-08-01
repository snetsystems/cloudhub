import React from 'react'
import ReactDOM from 'react-dom'
import _, {debounce} from 'lodash'

import walk, {
  TreeNode,
  Item,
  TreeNodeInArray,
  LocaleFunction,
  MatchSearchFunction,
} from 'src/reusable_ui/components/treemenu/TreeMenu/walk'
import {
  defaultChildren,
  TreeMenuChildren,
  TreeMenuItem,
} from 'src/reusable_ui/components/treemenu/TreeMenu/renderProps'
import KeyDown from 'src/reusable_ui/components/treemenu/KeyDown'
import {mxDragSource, mxGraph as mxGraphType} from 'mxgraph'
import {dragCell} from '../configurations/topology'
import {mxEvent, mxGraph, mxUtils} from '../containers/InventoryTopology'

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
  children?: TreeMenuChildren
  locale?: LocaleFunction
  matchSearch?: MatchSearchFunction
}

type TreeMenuState = {
  openNodes: string[]
  searchTerm: string
  activeKey: string
  focusKey: string
}

const defaultOnClick = (props: Item) => console.log(props) // eslint-disable-line no-console

class InventoryTreemenu extends React.Component<TreeMenuProps, TreeMenuState> {
  // private console.log('this.refs: ', )
  static defaultProps: TreeMenuProps = {
    data: {},
    graph: null,
    onClickItem: defaultOnClick,
    debounceTime: 125,
    children: defaultChildren,
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
    node,
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

    const dragElt = document.createElement('div')
    dragElt.style.border = 'dashed #f58220 1px'
    dragElt.style.width = `${90}px`
    dragElt.style.height = `${90}px`

    const dragSource = this.mx.mxUtils.makeDraggable(
      element,
      this.props.graph,
      dragCell(node),
      dragElt,
      0,
      0,
      true,
      true
    )

    dragSource.setGuidesEnabled(true)
  }

  public componentDidMount() {}

  componentDidUpdate(_prevProps, prevState) {
    if (prevState.activeKey !== this.state.activeKey) {
      console.log('this.props.data: ', this.props.data)
      // console.log('this.props.data: ', this.props.data)

      const activeKeys = this.state.activeKey.split('/')
      const focusKeys = this.state.focusKey.split('/')

      console.log('activeKey: ', activeKeys)
      console.log('focusKey: ', focusKeys)
      console.log('this.props.data: ', this.props.data[activeKeys[0]])

      // console.log(this.props.data[splitKey[0]])
      // console.log(_.values(this.props.data[splitKey[0]].nodes))
      // let count = 0

      // const dkeys = _.keys(this.props.data)
      // _.forEach(dkeys, dkey => {
      //   const ikeys = _.keys(this.props.data[dkey].nodes)
      //   // if (!_.isEmpty(ikeys)) {
      //   //   _.forEach(ikeys, ikey => {
      //   //     console.log('ikey', this.props.data[dkey].nodes[ikey])
      //   //   })
      //   // }
      // })
      // console.log('this.props.data: ', this.props.data)
      // console.log('key:', key)

      // let selectItem = null
      // splitKey.forEach(s => {
      //   selectItem = this.props.data[s]
      // })

      // console.log('this.props.data[this.state.activeKey]: ', selectItem)
      // console.log('selectItem.nodes: ', selectItem.nodes)
      // const treemenus = document
      //   .querySelector('#cloudInventoryContainer .tree-item-group')
      //   .querySelectorAll('li')
      // console.log('treemenus: ', treemenus)
      // console.log('this.props.data: ', this.props.data)
      // _.values(this.props.data).forEach(d => {
      //   console.log(d)
      // })
      // const f = _.find(_.values(this.props.data), d => {
      //   return _.find(treemenus, el => {
      //     return el.attributes['data-label'].value
      //     //   const dragElt = document.createElement('div')
      //     //   dragElt.style.border = 'dashed #f58220 1px'
      //     //   dragElt.style.width = `${90}px`
      //     //   dragElt.style.height = `${90}px`
      //     //   const value = el.textContent
      //     //   const node = {
      //     //     label: value,
      //     //     link: '',
      //     //     name: 'cloud',
      //     //     type: 'Cloud',
      //     //   }
      //     //   let ds = mxUtils.makeDraggable(
      //     //     el,
      //     //     this.props.graph,
      //     //     dragCell(node),
      //     //     dragElt,
      //     //     0,
      //     //     0,
      //     //     true,
      //     //     true
      //     //   )
      //     //   ds.setGuidesEnabled(true)
      //   })
      //   // console.log('d', d)
      // })
      // console.log('f: ', f)
      // if (prevState.openNodes !== this.state.openNodes) {
      //   const treemenus = document
      //     .querySelector('#cloudInventoryContainer .tree-item-group')
      //     .querySelectorAll('li')
      //   treemenus.forEach(menu => {
      //     mxEvent.removeAllListeners(menu)
      //     console.log('menu: ', {menu})
      //     // console.log('menu: ', menu['mxListenerList'])
      //     menu['mxListenerList'] = []
      //   })
      //   console.log('treemenus: ', treemenus)
      //   _.forEach(treemenus, el => {
      //     const dragElt = document.createElement('div')
      //     dragElt.style.border = 'dashed #f58220 1px'
      //     dragElt.style.width = `${90}px`
      //     dragElt.style.height = `${90}px`
      //     const value = el.textContent
      //     const node = {
      //       label: value,
      //       link: '',
      //       name: 'cloud',
      //       type: 'Cloud',
      //     }
      //     let ds = mxUtils.makeDraggable(
      //       el,
      //       this.props.graph,
      //       dragCell(node),
      //       dragElt,
      //       0,
      //       0,
      //       true,
      //       true
      //     )
      //     ds.setGuidesEnabled(true)
      //   })
      // }
    }
  }
  render() {
    const {children, hasSearch} = this.props
    const {searchTerm} = this.state

    const items = this.generateItems()
    const renderedChildren = children || defaultChildren
    const keyDownProps = this.getKeyDownProps(items)

    return (
      <KeyDown {...keyDownProps}>
        <div id={'cloudInventoryContainer'}>
          {renderedChildren(
            hasSearch
              ? {search: this.search, items, reset: this.reset, searchTerm}
              : {items, reset: this.reset}
          )}
        </div>
      </KeyDown>
    )
  }
}

export default InventoryTreemenu
