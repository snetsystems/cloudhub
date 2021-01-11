import AJAX from 'src/utils/ajax'

export const login = async ({url, user}) => {
  const makeURL = `${url}?id=${user.id}&password=${user.password}`
  console.log('login', {url, user}, makeURL)
  try {
    return await AJAX({
      method: 'GET',
      url,
      data: user,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const passwordChange = async ({url, user}) => {
  console.log('passwordChange', {url, user})

  const basicUser = {
    roles: {
      name: user.id,
      organization: user.currentOrganiztion,
    },
    password: user.password,
    email: user.email,
  }
  try {
    return await AJAX({
      method: 'PATCH',
      url,
      data: basicUser,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const passwordReset = async ({url, userId, passwordReturn = false}) => {
  const makeURL = `${url}?userID=${userId}&PWReturn=${passwordReturn}`
  console.log('makeURL: ', makeURL)
  try {
    return await AJAX({
      method: 'GET',
      url: makeURL,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createUser = async ({url, user}) => {
  const basicUser = {
    name: user.id,
    provider: 'cloudhub',
    roles: {
      name: 'editor',
      organization: 'default',
    },
    scheme: 'basic',
    superAdmin: false,
    password: user.password,
    email: user.email,
  }

  console.log('createUser url:', url, 'basicUser: ', basicUser)
  try {
    return await AJAX({
      method: 'POST',
      url,
      data: basicUser,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteUser = async ({url, user}) => {
  const makeURL = `${url}${user}`

  console.log('deleteUser makeURL: ', makeURL)
  try {
    return await AJAX({
      method: 'DELETE',
      url,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}
