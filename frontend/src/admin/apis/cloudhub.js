import AJAX from 'src/utils/ajax'

export const getUsers = async url => {
  try {
    return await AJAX({
      method: 'GET',
      url,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const getOrganizations = async url => {
  try {
    return await AJAX({
      method: 'GET',
      url,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createUser = async (url, user) => {
  try {
    return await AJAX({
      method: 'POST',
      url,
      data: user,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

// TODO: change updatedUserWithRolesOnly to a whole user that can have the
// original name, provider, and scheme once the change to allow this is
// implemented server-side
export const updateUser = async updatedUserWithRolesOnly => {
  try {
    return await AJAX({
      method: 'PATCH',
      url: updatedUserWithRolesOnly.links.self,
      data: updatedUserWithRolesOnly,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteUser = async user => {
  try {
    return await AJAX({
      method: 'DELETE',
      url: user.links.self,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createOrganization = async (url, organization) => {
  try {
    return await AJAX({
      method: 'POST',
      url,
      data: organization,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateOrganization = async organization => {
  try {
    return await AJAX({
      method: 'PATCH',
      url: organization.links.self,
      data: organization,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteOrganization = async organization => {
  try {
    return await AJAX({
      method: 'DELETE',
      url: organization.links.self,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

// Mappings
export const createMapping = async (url, mapping) => {
  try {
    return await AJAX({
      method: 'POST',
      resource: 'mappings',
      data: mapping,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const getMappings = async () => {
  try {
    return await AJAX({
      method: 'GET',
      resource: 'mappings',
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateMapping = async mapping => {
  try {
    return await AJAX({
      method: 'PUT',
      url: mapping.links.self,
      data: mapping,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteMapping = async mapping => {
  try {
    return await AJAX({
      method: 'DELETE',
      url: mapping.links.self,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createCloudServiceProvider = async params => {
  try {
    let newProvider = params.provider
    newProvider = newProvider
    const reqData = {
      ...params,
      provider: newProvider,
    }
    return await AJAX({
      url: `/cloudhub/v1/csp`,
      method: 'POST',
      data: reqData,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const updateCloudServiceProvider = async params => {
  try {
    const reqData = params
    delete reqData['provider']

    return await AJAX({
      url: `/cloudhub/v1/csp/${params.id}`,
      method: 'PATCH',
      data: reqData,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}
