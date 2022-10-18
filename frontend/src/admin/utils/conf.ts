// libraries
import _ from 'lodash'

// types
import {ProviderTypes} from 'src/admin/constants/providerConf'
import {OpenStackCspInput} from 'src/types/providerConf'

export const isRequiredCheck = (properties, section) => {
  switch (section) {
    case ProviderTypes.osp: {
      let emptyKey = null
      const inputs = properties as OpenStackCspInput
      delete inputs['id']
      for (const [key, value] of Object.entries(inputs)) {
        if (_.isEmpty(value)) {
          emptyKey = key
          break
        }
      }
      return emptyKey
    }

    default:
      return null
  }
}
