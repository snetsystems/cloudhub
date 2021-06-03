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
  type: string
  name: string
  label: string
  link?: string
  ipmi_target?: string
  ipmi_Host?: string
  ipmi_User?: string
  ipmi_Pass?: string
  [key: string]: any
}

export const toolsMenu: Menu[] = [
  {
    type: 'Server',
    name: 'server',
    label: 'Server',
    link: '',
    ipmi_target: '',
    ipmi_Host: '',
    ipmi_User: '',
    ipmi_Pass: '',
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
  isDisableName: false,
}

export const hostMenu: Menu = {
  ...tmpMenu,
  type: 'Server',
  isDisableName: true,
  link: '',
  ipmi_target: '',
  ipmi_host: '',
  ipmi_user: '',
  ipmi_pass: '',
}
