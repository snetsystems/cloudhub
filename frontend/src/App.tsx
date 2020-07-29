import React, {SFC, ReactChildren} from 'react'

import SideNav from 'src/side_nav'
import Notifications from 'src/shared/components/Notifications'
import ShellModaless from 'src/shared/components/ShellModaless'

interface Props {
  children: ReactChildren
}

const App: SFC<Props> = ({children}) => (
  <div className="cloudhub-root">
    <Notifications />
    <ShellModaless />
    <SideNav />
    {children}
  </div>
)

export default App
