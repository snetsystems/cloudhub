import React, {SFC, ReactChildren} from 'react'

import SideNav from 'src/side_nav'
import Notifications from 'src/shared/components/Notifications'
import ShellModal from 'src/shared/components/ShellModal'

interface Props {
  children: ReactChildren
}

const App: SFC<Props> = ({children}) => (
  <div className="cloudhub-root">
    <Notifications />
    <ShellModal />
    <SideNav />
    {children}
  </div>
)

export default App
