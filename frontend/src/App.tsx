import React, {FunctionComponent, ReactChildren} from 'react'
import SideNav from 'src/side_nav'
import Notifications from 'src/shared/components/Notifications'
import ShellModaless from 'src/shared/components/ShellModaless'
import {InjectedAuthReduxProps} from 'redux-auth-wrapper/history3/redirect'
interface Props extends InjectedAuthReduxProps {
  children: ReactChildren
}
const App: FunctionComponent<Props> = ({children}) => (
  <div className="cloudhub-root">
    <Notifications />
    <ShellModaless />
    <SideNav />
    {children}
  </div>
)
export default App
