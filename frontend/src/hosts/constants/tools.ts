interface toolbarCommandObject {
  actionName: string
  label: string
  icon: string
  isTransparent?: boolean
}
export const toolbarCommandObject: toolbarCommandObject[] = [
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
