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

export interface Menu {
  type: string
  name: string
  label: string
  href?: string
  idrac?: string
}

export const toolsMenu: Menu[] = [
  {
    type: 'Server',
    name: 'server',
    label: 'Server',
    href: '',
    idrac: '',
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

export const hostMenu: Menu = {
  type: 'Server',
  name: '',
  label: '',
  href: '',
  idrac: '',
}
