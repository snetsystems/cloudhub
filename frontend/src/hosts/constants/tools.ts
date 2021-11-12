interface ToolbarMenu {
  actionName: string
  label: string
  icon: string
  isTransparent?: boolean
}

export const toolbarMenu: ToolbarMenu[] = [
  {
    actionName: 'group',
    label: 'group',
    icon: 'object-group',
  },
  {
    actionName: 'ungroup',
    label: 'Ungroup',
    icon: 'object-ungroup',
  },
  {
    actionName: 'delete',
    label: 'Delete',
    icon: 'trash',
  },
  {
    actionName: 'cut',
    label: 'Cut',
    icon: 'scissors',
  },
  {
    actionName: 'copy',
    label: 'Copy',
    icon: 'copy',
  },
  {
    actionName: 'paste',
    label: 'Paste',
    icon: 'paste',
  },
  {
    actionName: 'undo',
    label: 'Undo',
    icon: 'undo',
  },
  {
    actionName: 'redo',
    label: 'Redo',
    icon: 'redo',
  },
  {
    actionName: 'zoomIn',
    label: 'Zoon in',
    icon: 'zoom-in',
  },
  {
    actionName: 'zoomOut',
    label: 'Zoom out',
    icon: 'zoom-out',
  },
  {
    actionName: 'fit',
    label: 'Fit',
    icon: 'fit',
  },
  // {
  //   actionName: 'export',
  //   label: 'Export',
  //   icon: 'export',
  // },
]

export interface Menu {
  class?: string[]
  type: string
  name: string
  label: string
  link?: string
  using_minion?: string
  ipmi_host?: string
  ipmi_user?: string
  ipmi_pass?: string
  parent?: string
  timeseries_host?: boolean
  data_navi?: string
}

export type keysMenu = keyof Menu

export type OrderMenu = {
  [key in keysMenu]: {order: number}
}

export const orderMenu: OrderMenu = {
  class: {order: 0},
  type: {order: 0},
  name: {order: 1},
  label: {order: 2},
  link: {order: 3},
  using_minion: {order: 4},
  ipmi_host: {order: 5},
  ipmi_user: {order: 6},
  ipmi_pass: {order: 7},
  parent: {order: 8},
  timeseries_host: {order: 9},
  data_navi: {order: 10},
}

export const toolsMenu: Menu[] = [
  {
    type: 'Server',
    name: 'server',
    label: 'Server',
    link: '',
  },
  {
    type: 'Database',
    name: 'database',
    label: 'Database',
    link: '',
  },
  {
    type: 'Internet',
    name: 'internet',
    label: 'Internet',
    link: '',
  },
  {
    type: 'Workstation',
    name: 'workstation',
    label: 'Workstation',
    link: '',
  },
  {
    type: 'VirtualMachine',
    name: 'virtual-machine',
    label: 'VirtualMachine',
    link: '',
  },
  {
    type: 'Email',
    name: 'email',
    label: 'Email',
    link: '',
  },
  {
    type: 'Firewall',
    name: 'firewall',
    label: 'Firewall',
    link: '',
  },
  {
    type: 'Router',
    name: 'router',
    label: 'Router',
    link: '',
  },
  {
    type: 'WirelessRouter',
    name: 'wireless-router',
    label: 'WirelessRouter',
    link: '',
  },
  {
    type: 'Switch',
    name: 'switch',
    label: 'Switch',
    link: '',
  },
  {
    type: 'Cloud',
    name: 'cloud',
    label: 'Cloud',
    link: '',
  },
]

export const tmpMenu: Menu = {
  type: '',
  name: '',
  label: '',
  link: '',
}

export const hostMenu: Menu = {
  ...tmpMenu,
  type: 'Server',
  link: '',
}

export enum NodeType {
  Server = 'Server',
  Database = 'Database',
  Internet = 'Internet',
  Workstation = 'Workstation',
  VirtualMachine = 'VirtualMachine',
  Email = 'Email',
  Firewall = 'Firewall',
  Router = 'Router',
  WirelessRouter = 'WirelessRouter',
  Switch = 'Switch',
  Cloud = 'Cloud',
  Group = 'Group',
  Edge = 'Edge',
}

export type NodeTypeInterface = {
  [key in NodeType]: {
    attrs: Menu
    hideAttrs: keysMenu[]
    disableAttrs: keysMenu[]
  }
}

export const defaultHideAttrs: keysMenu[] = [
  'class',
  'type',
  'timeseries_host',
  // 'name',
  'parent',
  'data_navi',
]
export const defaultDisableAttrs: keysMenu[] = []

export const defaultNodeTypeSettings = {
  attrs: {...tmpMenu},
  hideAttrs: [...defaultHideAttrs],
  disableAttrs: [...defaultDisableAttrs],
}

export const eachNodeTypeAttrs: NodeTypeInterface = {
  [NodeType.Server]: {
    ...defaultNodeTypeSettings,
    attrs: {
      ...defaultNodeTypeSettings.attrs,
      // link: '',
      using_minion: '',
      ipmi_host: '',
      ipmi_user: '',
      ipmi_pass: '',
      parent: '',
      data_navi: '',
      timeseries_host: false,
    },
    hideAttrs: [...defaultNodeTypeSettings.hideAttrs],
    // disableAttrs: [...defaultNodeTypeSettings.disableAttrs, 'name'],
    disableAttrs: [...defaultNodeTypeSettings.disableAttrs],
  },
  [NodeType.Database]: {
    ...defaultNodeTypeSettings,
    attrs: {
      ...defaultNodeTypeSettings.attrs,
    },
  },
  [NodeType.Internet]: {...defaultNodeTypeSettings},
  [NodeType.Workstation]: {...defaultNodeTypeSettings},
  [NodeType.VirtualMachine]: {...defaultNodeTypeSettings},
  [NodeType.Email]: {...defaultNodeTypeSettings},
  [NodeType.Firewall]: {...defaultNodeTypeSettings},
  [NodeType.Router]: {...defaultNodeTypeSettings},
  [NodeType.WirelessRouter]: {...defaultNodeTypeSettings},
  [NodeType.Switch]: {...defaultNodeTypeSettings},
  [NodeType.Cloud]: {
    ...defaultNodeTypeSettings,
  },
  [NodeType.Group]: {
    ...defaultNodeTypeSettings,
    hideAttrs: [...defaultNodeTypeSettings.hideAttrs, 'name'],
  },
  [NodeType.Edge]: {
    ...defaultNodeTypeSettings,
    hideAttrs: [...defaultNodeTypeSettings.hideAttrs, 'name'],
  },
}
