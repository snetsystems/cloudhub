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

export const passwordChange = async ({url, user}) => {
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

export const passwordReset = async ({url, user}) => {
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
