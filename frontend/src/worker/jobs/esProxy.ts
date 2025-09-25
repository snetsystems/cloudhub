// Libraries
import axios from 'axios'
import qs from 'qs'
import type {Message} from 'src/worker/types'

const esProxy = async (msg: Message) => {
  const {
    payload: {url: proxyUrl, esReq},
  } = msg as Message & {
    payload: {
      url: string
      esReq: {
        path: string
        params?: Record<string, any>
        method?: 'GET' | 'POST'
        body?: any
        uuid?: string
      }
    }
  }

  const {path, params, method = 'POST', body, uuid} = esReq

  const finalUrl =
    proxyUrl.replace(/\/+$/, '') +
    (path.startsWith('/') ? path : '/' + path) +
    (params ? `?${qs.stringify(params)}` : '')

  try {
    const {data, status} = await axios.request({
      url: finalUrl,
      method,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        ...(uuid && {'x-trace-uuid': uuid}),
      },
    })
    return {status, data}
  } catch (e) {
    console.error('[Worker][ESPROXY]', e.message, e.response?.data)
    throw e
  }
}

export default esProxy
