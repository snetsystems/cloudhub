export type Action = ConnectedSourceAction | DeletedSourceAction
export enum ActionTypes {
  ConnectedSource = 'CONNECTED_SOURCE',
  DeletedSource = 'DELETED_SOURCE',
}

export interface ConnectedSourceAction {
  type: ActionTypes.ConnectedSource
  payload: string
}

export type connectedSourceAction = (sourceID: string) => ConnectedSourceAction

export const connectedSource = (sourceID: string): ConnectedSourceAction => ({
  type: ActionTypes.ConnectedSource,
  payload: sourceID,
})

export interface DeletedSourceAction {
  type: ActionTypes.DeletedSource
  payload: string
}

export type deletedSourceAction = (sourceID: string) => DeletedSourceAction

export const deletedSource = (sourceID: string): DeletedSourceAction => ({
  type: ActionTypes.DeletedSource,
  payload: sourceID,
})
