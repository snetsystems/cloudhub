interface ToolbarMenu {
  actionName: string
  label: string
  icon: string
  isTransparent?: boolean
}

export const toolbarMenu: ToolbarMenu[] = [
  {
    actionName: 'groupOrUngroup',
    label: '(Un)group',
    icon: 'object-group',
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
    actionName: 'collapseAll',
    label: 'Collapse All',
    icon: 'callapse-plus',
  },
  {
    actionName: 'expandAll',
    label: 'Expand All',
    icon: 'callapse-minus',
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
  {
    actionName: 'export',
    label: 'Export',
    icon: 'export',
  },
]

export interface Node {
  type: string
  name: string
  label: string
  href?: string
}

export const toolsMenu: Node[] = [
  {
    type: 'Server',
    name: 'server',
    label: 'Server',
    href: '',
  },
  {
    type: 'Database',
    name: 'database',
    label: 'Database',
    href: '',
  },
  {
    type: 'Internet',
    name: 'internet',
    label: 'Internet',
    href: '',
  },
  {
    type: 'Workstation',
    name: 'workstation',
    label: 'Workstation',
    href: '',
  },
  {
    type: 'VirtualMachine',
    name: 'virtual-machine',
    label: 'VirtualMachine',
    href: '',
  },
  {
    type: 'Email',
    name: 'email',
    label: 'Email',
    href: '',
  },
  {
    type: 'Firewall',
    name: 'firewall',
    label: 'Firewall',
    href: '',
  },
  {
    type: 'Router',
    name: 'router',
    label: 'Router',
    href: '',
  },
  {
    type: 'WirelessRouter',
    name: 'wireless-router',
    label: 'WirelessRouter',
    href: 'asdasd',
  },
]

export const hostsMenu: Node[] = [
  {
    type: 'Server',
    name: 'a',
    label: 'A',
    href: '',
  },
  {
    type: 'Server',
    name: 'b',
    label: 'B',
    href: '',
  },
  {
    type: 'Server',
    name: 'c',
    label: 'C',
    href: '',
  },
  {
    type: 'Server',
    name: 'd',
    label: 'D',
    href: '',
  },
  {
    type: 'Server',
    name: 'e',
    label: 'E',
    href: '',
  },
]
