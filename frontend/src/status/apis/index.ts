import AJAX from 'src/utils/ajax'

export const fetchJSONFeed = async (url: string) => {
  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
  })

  return response.json()
}

export const api = {
  get: (url: string, config?: any) => AJAX({url, method: 'GET', ...config}),
  post: (url: string, data?: any, config?: any) =>
    AJAX({url, method: 'POST', data, ...config}),
  put: (url: string, data?: any, config?: any) =>
    AJAX({url, method: 'PUT', data, ...config}),
  patch: (url: string, data?: any, config?: any) =>
    AJAX({url, method: 'PATCH', data, ...config}),
  delete: (url: string, config?: any) =>
    AJAX({url, method: 'DELETE', ...config}),
}
