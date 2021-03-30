const initialState = {
  links: {},
  auth: {},
}

const config = (state = initialState, action) => {
  switch (action.type) {
    case 'CLOUDHUB_GET_AUTH_CONFIG_COMPLETED':
    case 'CLOUDHUB_UPDATE_AUTH_CONFIG_REQUESTED':
    case 'CLOUDHUB_UPDATE_AUTH_CONFIG_FAILED': {
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
