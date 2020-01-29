import {getAJAX, setAJAXLinks} from 'src/utils/ajax'

import {linksLink} from 'src/shared/constants'

export const getLinks = async () => {
  try {
    const response = await getAJAX(linksLink)
    setAJAXLinks({updatedLinks: response.data})
    return response
  } catch (error) {
    console.error(error)
    throw error
  }
}
