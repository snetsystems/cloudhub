/* eslint-disable @typescript-eslint/ban-types */
import axios, {AxiosResponse, CancelTokenSource, Method} from 'axios'
import _ from 'lodash'

let links
export const setAJAXLinks = ({updatedLinks}): void => {
  links = updatedLinks
}

// do not prefix route with basepath, ex. for external links
const addBasepath = (url, excludeBasepath): string => {
  const basepath = window.basepath || ''

  return excludeBasepath ? url : `${basepath}${url}`
}

interface Links {
  auth: object
  logoutLink: object
  external: object
  users: object
  allUsers: object
  organizations: object
  meLink: object
  config: object
  environment: object
  flux: object
}

interface LinksInputs {
  auth: object
  logout: object
  basicLogout: object
  external: object
  users: object
  allUsers: object
  organizations: object
  me: object
  config: object
  environment: object
  flux: object
}

function generateResponseWithLinks<T extends {[key: string]: any}>(
  response: T,
  newLinks: LinksInputs
): T & Links {
  const {
    auth,
    logout,
    external,
    users,
    allUsers,
    organizations,
    me: meLink,
    config,
    environment,
    flux,
    basicLogout,
  } = newLinks

  const linksObj = {
    auth: {links: auth},
    logoutLink: response?.data.provider === 'cloudhub' ? basicLogout : logout,
    external,
    users,
    allUsers,
    organizations,
    meLink,
    config,
    environment,
    flux,
  }

  return Object.assign({}, response, linksObj)
}

interface RequestParams {
  url?: string | string[]
  resource?: string
  id?: string
  method?: Method
  data?: object | string
  params?: object
  headers?: object
  validateStatus?: (status: number) => boolean
  cancelToken?: CancelTokenSource['token']
}

async function AJAX<T = any>(
  {
    url,
    resource = null,
    id = null,
    method = 'GET',
    data = {},
    params = {},
    headers = {},
    cancelToken = null,
  }: RequestParams,
  excludeBasepath = false
): Promise<(T | (T & {links: object})) | AxiosResponse<T>> {
  try {
    url = addBasepath(url, excludeBasepath)

    if (resource && links) {
      url = id
        ? addBasepath(`${links[resource]}/${id}`, excludeBasepath)
        : addBasepath(`${links[resource]}`, excludeBasepath)
    }

    const response = await axios.request<T>({
      url,
      method,
      data,
      params,
      headers,
      cancelToken,
    })

    // TODO: Just return the unadulterated response without grafting auth, me,
    // and logoutLink onto this object, once those are retrieved via their own
    // AJAX request and action creator.
    return links ? generateResponseWithLinks(response, links) : response
  } catch (error) {
    const {response} = error
    if (response) {
      throw links ? generateResponseWithLinks(response, links) : response // eslint-disable-line no-throw-literal
    } else {
      throw error
    }
  }
}

export async function getAJAX<T = any>(url: string): Promise<AxiosResponse<T>> {
  try {
    return await axios.request<T>({method: 'GET', url: addBasepath(url, false)})
  } catch (error) {
    console.error(error)
    throw error
  }
}

interface cancelablePromise {
  promise: Promise<void>
  cancel: CancelTokenSource['cancel']
  cancelMessage?: string
}

interface cancelableRequestParams extends RequestParams {
  cancelMessage?: string
}

export async function cancelablePromise(params: cancelableRequestParams) {
  if (!this) return

  if (!this?._cancelablePromises) {
    this['_cancelablePromises'] = []
    this._cancelablePromises as cancelablePromise[]
  }

  const {token, cancel} = axios.CancelToken.source()
  params = {...params, cancelToken: token}

  const promise = AJAX({...params})
    .then(response => {
      this.promises = _.filter(this.promises, p => p.promise !== promise)
      return response
    })
    .catch(error => {
      if (axios.isCancel(error)) {
        let message = '[Request canceled] '

        if (error.message) {
          message += error.message
        }

        console.warn(message)
        throw error
      } else {
        throw error
      }
    })

  let cancelablePromise: cancelablePromise = {
    promise,
    cancel,
    cancelMessage: params.cancelMessage,
  }

  this._cancelablePromises.push(cancelablePromise)
  return promise
}

export function cancelPendingPromises() {
  if (this?._cancelablePromises) {
    _.forEach(this._cancelablePromises, p => p.cancel(p?.cancelMessage))
  }
}

export function createCancelableAJAX() {
  return {
    cancelablePromise: cancelablePromise.bind(this),
    cancelPendingPromises: cancelPendingPromises.bind(this),
  }
}

export default AJAX
