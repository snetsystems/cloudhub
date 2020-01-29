import {LinksGetCompletedAction} from 'src/shared/actions/links'

const initialState = {
  external: {statusFeed: ''},
  custom: [],
}

const linksReducer = (
  state = initialState,
  action: LinksGetCompletedAction
) => {
  switch (action.type) {
    case 'LINKS_GET_COMPLETED': {
      const {links} = action.payload
      return {...links}
    }
  }

  return state
}

export default linksReducer
