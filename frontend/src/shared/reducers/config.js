const initialState = {
  links: {},
  auth: {},
}

const config = (state = initialState, action) => {
  switch (action.type) {
    case 'CMP_GET_AUTH_CONFIG_COMPLETED':
    case 'CMP_UPDATE_AUTH_CONFIG_REQUESTED':
    case 'CMP_UPDATE_AUTH_CONFIG_FAILED': {
      const {authConfig: auth} = action.payload
      return {
        ...state,
        auth: {...auth},
      }
    }
  }

  return state
}

export default config
