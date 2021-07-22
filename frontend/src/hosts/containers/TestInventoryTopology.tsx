import React, {PureComponent} from 'react'

import {jsxTab, htmlTab} from './prism-tabs'
import {DockLayout, DividerBox, LayoutData, DockContextType} from 'rc-dock'

import 'rc-dock/dist/rc-dock.css'
import {Page} from 'src/reusable_ui'

let tab = {
  content: <div>Tab Content</div>,
  closable: true,
}

let layout = {
  dockbox: {
    mode: 'horizontal',
    children: [
      {
        mode: 'vertical',
        size: 200,
        children: [
          {
            tabs: [
              {...tab, id: 't1', title: 'Tab 1'},
              {...tab, id: 't2', title: 'Tab 2'},
            ],
          },
          {
            tabs: [
              {
                ...tab,
                id: 't3',
                title: 'Min Size',
                content: (
                  <div>
                    <p>This tab has a minimal size</p>
                    150 x 150 px
                  </div>
                ),
                minWidth: 150,
                minHeight: 150,
              },
              {...tab, id: 't4', title: 'Tab 4'},
            ],
          },
        ],
      },
      {
        size: 1000,
        tabs: [
          {
            ...tab,
            id: 't5',
            title: 'basic demo',
            content: (
              <div>
                This panel won't be removed from layout even when last Tab is
                closed
              </div>
            ),
          },
          jsxTab,
          htmlTab,
        ],
        panelLock: {panelStyle: 'main'},
      },
      {
        size: 200,
        tabs: [{...tab, id: 't8', title: 'Tab 8'}],
      },
    ],
  },
  floatbox: {
    mode: 'float',
    children: [
      {
        tabs: [
          {...tab, id: 't9', title: 'Tab 9', content: <div>Float</div>},
          {...tab, id: 't10', title: 'Tab 10'},
        ],
        x: 300,
        y: 150,
        w: 400,
        h: 300,
      },
    ],
  },
}
if (window.innerWidth < 600) {
  // remove a column for mobile
  layout.dockbox.children.pop()
}

let count = 0
interface Props {}

interface State {
  boxLayout: LayoutData
}

export default class TestInventoryTopology extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      boxLayout: layout,
    }
  }

  public componentDidMount() {
    console.log('componentDidMount')
    // this.setState({boxLayout: layout})
  }

  public render() {
    return (
      <Page className="container-fluid full-height">
        <Page.Header>
          <Page.Header.Left>
            <Page.Title title="Test" />
          </Page.Header.Left>
          <Page.Header.Right />
        </Page.Header>
        <Page.Contents fullWidth={true}>
          <DockLayout
            onLayoutChange={evt => {
              console.log(evt)
            }}
            // layout={this.state.boxLayout}
            defaultLayout={this.state.boxLayout}
            style={{
              position: 'absolute',
              left: 10,
              top: 10,
              right: 10,
              bottom: 10,
            }}
          />
        </Page.Contents>
      </Page>
    )
  }
}
