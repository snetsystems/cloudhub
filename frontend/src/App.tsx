import React, {SFC, ReactChildren} from 'react'

import SideNav from 'src/side_nav'
import Notifications from 'src/shared/components/Notifications'

interface Props {
  children: ReactChildren
}

const App: SFC<Props> = ({children}) => (
  <div className="cmp-root">
    <Notifications />
    <SideNav />
    {children}
  </div>
)

export default App
