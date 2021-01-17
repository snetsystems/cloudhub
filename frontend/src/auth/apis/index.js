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
  console.log(`Password Reset GET@${makeURL}`)
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
  console.log(`OTP Change PATCH@${url}, user:${JSON.stringify(user)}`)

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

  console.log(`createUser POST@${url}, ${JSON.stringify(basicUser)}`)
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
  console.log(`get user GET@${url}`)

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

  console.log(`updateUser PATCH@${url} user:${JSON.stringify(basicUser)}`)
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

  console.log(`deleteUser DELETE@${makeURL}`)
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
