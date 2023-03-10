import _ from 'lodash'
import {Addon} from 'src/types/auth'

export const addOnCsp = (filterType, addons: Addon[]) => {
  return _.values(
    _.filter(filterType, (_value, key) => {
      return (
        _.get(
          _.find(addons, addon => addon.name === key),
          'url',
          'off'
        ) === 'on'
      )
    })
  )
}
