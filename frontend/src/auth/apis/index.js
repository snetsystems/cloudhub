import AJAX from 'src/utils/ajax'

export const login = async ({url, user}) => {
  try {
    return await AJAX({
      method: 'POST',
      url: url,
      data: user,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const passwordReset = async ({url, userId, passwordReturn = false}) => {
  const makeURL = `${url}?path=${''}&name=${userId}&pwrtn=${passwordReturn}`
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

export const otpChange = async ({url, user}) => {
  try {
    return await AJAX({
      method: 'PATCH',
      url: url,
      data: user,
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
    roles: [
      {
        name: 'member',
        organization: 'default',
      },
    ],
    scheme: 'basic',
    superAdmin: false,
    password: user.password,
    email: user.email,
  }

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

export const getUser = async ({url}) => {
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

export const updateUser = async ({url, user}) => {
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

export const deleteUser = async ({url, user}) => {
  const makeURL = `${url}${user}`

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
