// libraries
import _ from 'lodash'

// types
import {ProviderTypes} from 'src/admin/constants/providerConf'
import {notifyInvalidProperty} from 'src/shared/copy/notifications'
import {OpenStackCspInput} from 'src/types/providerConf'

export const valiDationCheck = (properties, section) => {
  switch (section) {
    case ProviderTypes.osp: {
      let invalidationProperty = null
      const {
        projectName,
        authUrl,
        userName,
        password,
        projectDomain,
        userDomain,
      } = properties as OpenStackCspInput

      const inputs = {
        projectName,
        authUrl,
        userName,
        password,
        projectDomain,
        userDomain,
      }
      for (const [key, value] of Object.entries(inputs)) {
        if (_.isEmpty(value)) {
          invalidationProperty = `Please enter '${key}' value.`
          break
        }
      }
      if (invalidationProperty) {
        return notifyInvalidProperty(invalidationProperty)
      }

      const extract = projectName.match(/^\w+$/)
      if (!extract) {
        invalidationProperty =
          'Project Name must not have any blank and prevent the special symbols eg, #, $, &, ^, |, % etc. Regular Exp. pattern is applied by "/^w+$/"'
        return notifyInvalidProperty(invalidationProperty)
      }
    }

    default:
      return null
  }
}
