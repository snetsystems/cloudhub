// Libraries
import {Container} from 'unstated'
import _ from 'lodash'

export interface AuthState {
  userID: string
}

const DEFAULT_STATE = (): AuthState => ({
  userID: '',
})

export class AuthContainer extends Container<AuthState> {
  public state: AuthState = DEFAULT_STATE()

  public handleUpdateUserID = (userID: string) => {
    console.log('handleUpdateUserID userID: ', userID)
    return this.setState({userID})
  }
}
