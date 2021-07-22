import React from 'react'
import {TabData, DockLayout, DividerBox, LayoutData, BoxBase} from 'rc-dock'

let name = window.location.pathname.split('/').pop()
name = name.substr(0, name.length - 5)

export const jsxTab: TabData = {
  id: 'jsxTab',
  title: 'jsx',
  closable: false,
  content: <div>Tabl Data here</div>,
}

export const htmlTab: TabData = {
  id: 'htmlTab',
  title: 'html',
  closable: true,
  content: <div>Tabl Data here</div>,
}
