export interface ESProxyQuery {
  host: string
  path: string
  method?: 'GET' | 'POST'
  body?: Record<string, any>
  params?: Record<string, string | number | boolean>
  uuid?: string
}
