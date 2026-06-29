// formatHubbleError turns the various error shapes CloudHub's AJAX util
// throws (axios response object on HTTP errors, raw Error on network
// failures, plain strings) into a human-readable string for the UI.
export const formatHubbleError = (e: unknown): string => {
  if (!e) return 'Unknown error'
  if (typeof e === 'string') return e
  const err = e as {
    status?: number
    statusText?: string
    data?: {message?: string}
    message?: string
  }
  if (err.status) {
    const body = err.data?.message ? `: ${err.data.message}` : ''
    return `${err.status} ${err.statusText || ''}${body}`.trim()
  }
  if (err.message) return err.message
  return String(e)
}
