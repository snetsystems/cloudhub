import AJAX from 'src/utils/ajax'

export const login = async ({url, user}) => {
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

export const passwordReset = async ({
  url,
  path,
  name,
  passwordReturn = false,
}) => {
  const makeURL = `${url}?path=${path}&name=${name}&pwrtn=${passwordReturn}`
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
      url,
      data: user,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createUser = async ({url, user}) => {
  const basicUser = {
    ...user,
    provider: 'cloudhub',
    roles: [
      {
        name: 'member',
        organization: 'default',
      },
    ],
    scheme: 'basic',
    superAdmin: false,
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
  try {
    return await AJAX({
      method: 'PATCH',
      url,
      data: user,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}
