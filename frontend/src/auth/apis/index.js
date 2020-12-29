import AJAX from 'src/utils/ajax'

export const login = async ({url, id, password}) => {
  try {
    return await AJAX({
      method: 'POST',
      url,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const logout = async ({url}) => {
  try {
    return await AJAX({
      method: 'POST',
      url,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const passwordChange = async ({url, id, password}) => {
  try {
    const data = {
      id,
      password,
    }
    return await AJAX({
      method: 'PATCH',
      url,
      data,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const passwordReset = async ({url}) => {
  try {
    return await AJAX({
      method: 'PATCH',
      url,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const createUser = async ({url, id, password}) => {
  try {
    const data = {
      id,
      password,
    }

    return await AJAX({
      method: 'POST',
      url,
      data,
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteUser = async ({url, id}) => {
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
