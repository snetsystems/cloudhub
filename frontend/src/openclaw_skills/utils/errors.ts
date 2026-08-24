// AJAX rejects with the raw axios response object, not an Error, so status and
// body have to be read off it directly.
interface RejectedResponse {
  status?: number
  data?: {message?: string}
}

const FALLBACK: {[status: number]: string} = {
  401: '인증된 조직 컨텍스트가 필요합니다. 다시 로그인해 주세요.',
  403: '스킬 저작은 Admin 권한이 필요합니다.',
  404: '이 조직에서 찾을 수 없는 스킬입니다.',
  409: '조직에 게이트웨이 에이전트가 매핑되어 있지 않습니다.',
  422: '입력값이 유효하지 않습니다.',
  502: '게이트웨이 요청이 실패했습니다.',
  503: 'OpenClaw 게이트웨이가 구성되어 있지 않습니다.',
}

export const describeError = (error: RejectedResponse): string => {
  const message = error?.data?.message

  if (message) {
    return message
  }

  return FALLBACK[error?.status] || '알 수 없는 오류가 발생했습니다.'
}

export const errorStatus = (error: RejectedResponse): number =>
  error?.status || 0
