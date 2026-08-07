import React, {FunctionComponent, ReactChildren, Suspense} from 'react'
import SideNav from 'src/side_nav'
import Notifications from 'src/shared/components/Notifications'
import ShellModaless from 'src/shared/components/ShellModaless'
import PageSpinner from 'src/shared/components/PageSpinner'
import {InjectedAuthReduxProps} from 'redux-auth-wrapper/history3/redirect'
interface Props extends InjectedAuthReduxProps {
  children: ReactChildren
}
const App: FunctionComponent<Props> = ({children}) => (
  <div className="cloudhub-root">
    <Notifications />
    <ShellModaless />
    <SideNav />
    <Suspense fallback={<PageSpinner />}>{children}</Suspense>
  </div>
)
export default App
