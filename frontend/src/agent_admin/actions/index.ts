export enum ActionType {
  UpdateMasterAddress = 'UPDATE_MASTER_ADDRESS',
  UpdateMasterId = 'UPDATE_MASTER_ID',
  UpdateMasterPassword = 'UPDATE_MASTER_PASSWORD',
}

interface UpdateMasterAddressAction {
  type: ActionType.UpdateMasterAddress
  payload: {
    masterAddress: string
  }
}

interface UpdateMasterIdAction {
  type: ActionType.UpdateMasterId
  payload: {
    masterId: string
  }
}

interface UpdateMasterPasswordAction {
  type: ActionType.UpdateMasterPassword
  payload: {
    masterPassword: string
  }
}

export type AgentAction =
  | UpdateMasterAddressAction
  | UpdateMasterIdAction
  | UpdateMasterPasswordAction

export const UpdateMasterAddress = event => ({
  type: ActionType.UpdateMasterAddress,
  payload: {value: event.target.value},
})
