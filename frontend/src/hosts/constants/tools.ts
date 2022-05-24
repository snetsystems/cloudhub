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
  data_navi?: string
  status?: boolean
  detected?: boolean
  icon?: string
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
  data_navi: {order: 9},
  status: {order: 10},
  detected: {order: 11},
  icon: {order: 12},
}

export const toolsMenu: Menu[] = [
  {
    type: 'Server',
    name: 'server',
    label: 'Server',
    link: '',
    status: false,
    detected: false,
    icon: 'Server',
  },
  {
    type: 'Database',
    name: 'database',
    label: 'Database',
    link: '',
    status: false,
    detected: false,
    icon: 'Database',
  },
  {
    type: 'Internet',
    name: 'internet',
    label: 'Internet',
    link: '',
    status: false,
    detected: false,
    icon: 'Internet',
  },
  {
    type: 'Workstation',
    name: 'workstation',
    label: 'Workstation',
    link: '',
    status: false,
    detected: false,
    icon: 'Workstation',
  },
  {
    type: 'VirtualMachine',
    name: 'virtual-machine',
    label: 'VirtualMachine',
    link: '',
    status: false,
    detected: false,
    icon: 'VirtualMachine',
  },
  {
    type: 'Email',
    name: 'email',
    label: 'Email',
    link: '',
    status: false,
    detected: false,
    icon: 'Email',
  },
  {
    type: 'Firewall',
    name: 'firewall',
    label: 'Firewall',
    link: '',
    status: false,
    detected: false,
    icon: 'Firewall',
  },
  {
    type: 'Router',
    name: 'router',
    label: 'Router',
    link: '',
    status: false,
    detected: false,
    icon: 'Router',
  },
  {
    type: 'WirelessRouter',
    name: 'wireless-router',
    label: 'WirelessRouter',
    link: '',
    status: false,
    detected: false,
    icon: 'WirelessRouter',
  },
  {
    type: 'Switch',
    name: 'switch',
    label: 'Switch',
    link: '',
    status: false,
    detected: false,
    icon: 'Switch',
  },
  {
    type: 'Cloud',
    name: 'cloud',
    label: 'Cloud',
    link: '',
    status: false,
    detected: false,
    icon: 'Cloud',
  },
  {
    type: 'Elb',
    name: 'elastic-load-balancing',
    label: 'ELB',
    link: '',
    status: false,
    detected: false,
    icon: 'ELB',
  },
]

export const tmpMenu: Menu = {
  type: '',
  name: '',
  label: '',
  link: '',
  status: false,
  detected: false,
  icon: '',
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
  Elb = 'Elb',
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
  'parent',
  'data_navi',
  'detected',
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
      using_minion: '',
      ipmi_host: '',
      ipmi_user: '',
      ipmi_pass: '',
      parent: '',
      data_navi: '',
      icon: 'server',
    },
    hideAttrs: [...defaultNodeTypeSettings.hideAttrs],
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
  [NodeType.Elb]: {...defaultNodeTypeSettings},
  [NodeType.Group]: {
    ...defaultNodeTypeSettings,
    hideAttrs: [
      ...defaultNodeTypeSettings.hideAttrs,
      'name',
      'status',
      'link',
      'icon',
    ],
  },
  [NodeType.Edge]: {
    ...defaultNodeTypeSettings,
    hideAttrs: [
      ...defaultNodeTypeSettings.hideAttrs,
      'name',
      'status',
      'link',
      'icon',
    ],
  },
}
