import {
  ActionTypes,
  SetTelegrafSystemIntervalAction,
} from 'src/types/actions/app'

export type SetTelegrafSystemIntervalActionCreator = (
  telegrafSystemInterval: string
) => SetTelegrafSystemIntervalAction

export const setTelegrafSystemInterval: SetTelegrafSystemIntervalActionCreator = (
  telegrafSystemInterval
): SetTelegrafSystemIntervalAction => ({
  type: ActionTypes.SetTelegrafSystemInterval,
  payload: {
    telegrafSystemInterval,
  },
})
